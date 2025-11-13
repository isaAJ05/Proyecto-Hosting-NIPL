import threading
import time
from datetime import datetime, timezone
from models.project_models import load_db, stop_project


def _parse_iso(s):
    if not s:
        return None
    try:
        # datetime.fromisoformat handles the timezone-aware ISO strings we store
        return datetime.fromisoformat(s)
    except Exception:
        return None


def cleanup_idle_projects(idle_seconds=30 * 60, interval_seconds=5 * 60, stop_on_error=False):
    """
    Loop that checks projects DB and stops projects that have been inactive
    for longer than `idle_seconds`.

    - idle_seconds: seconds of inactivity after which a running project is stopped (default 30min)
    - interval_seconds: how often to run the check (default 5min)
    """
    print(f"[cleanup] Cleaner started: idle_seconds={idle_seconds}, interval_seconds={interval_seconds}")
    while True:
        try:
            db = load_db() or {}
            now = datetime.now(timezone.utc)
            # Attempt to use Docker StartedAt for authoritative running time when possible
            try:
                try:
                    import docker
                except Exception:
                    docker = None
            except Exception:
                docker = None

            for pid, proj in list((db or {}).items()):
                try:
                    status = (proj.get('status') or '').lower()
                    # Only consider running containers
                    if status != 'running':
                        continue

                    started_dt = None
                    # Try Docker inspection first
                    if docker is not None:
                        try:
                            client = docker.from_env()
                            c = client.containers.get(proj.get('container_id'))
                            # reload to ensure fresh attrs
                            c.reload()
                            started_at = c.attrs.get('State', {}).get('StartedAt')
                            started_dt = _parse_iso(started_at)
                        except Exception:
                            started_dt = None

                    # Fallback to DB timestamps
                    if started_dt is None:
                        last_access = proj.get('last_access') or proj.get('last_started')
                        started_dt = _parse_iso(last_access)

                    if started_dt is None:
                        # Cannot determine time; skip
                        continue

                    delta = (now - started_dt).total_seconds()
                    if delta >= idle_seconds:
                        print(f"[cleanup] Stopping idle project {pid} (idle {int(delta)}s)")
                        ok, msg = stop_project(pid)
                        if not ok:
                            print(f"[cleanup] Failed stopping {pid}: {msg}")
                except Exception as e:
                    print(f"[cleanup] Error handling project {pid}: {e}")
        except Exception as e:
            print(f"[cleanup] Error during cleanup loop: {e}")
            if stop_on_error:
                break
        # Sleep until next check
        time.sleep(interval_seconds)


def start_cleanup_thread(idle_seconds=30 * 60, interval_seconds=5 * 60):
    t = threading.Thread(target=cleanup_idle_projects, args=(idle_seconds, interval_seconds), daemon=True)
    t.start()
    return t
