import os
import json
import uuid
import subprocess
from datetime import datetime, timezone
from models.containers_models import build_and_run

try:
    import docker
except Exception:
    docker = None

# Paths
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DB_PATH = os.path.join(ROOT, '..', 'projects.json')
PROJECTS_DIR = os.path.join(ROOT, '..', 'deployed_projects')
os.makedirs(PROJECTS_DIR, exist_ok=True)


def load_db():
    if not os.path.exists(DB_PATH):
        return {}
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except Exception:
            return {}


def save_db(db):
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, default=str)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _sanitize(s: str) -> str:
    s = (s or '').strip().lower()
    import re
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s or 'x'

def _email_localpart(e):
    if not e:
        return None
    try:
        return e.split('@', 1)[0].strip().lower()
    except Exception:
        return e.strip().lower()

def create_project_from_repo(repo_url, name, user='anon', subdomain=None, cpu=None, memory=None, owner_email=None, owner_token_contract=None):
    if not name or not repo_url:
        return False, 'name and repo_url required'

    project_id = str(uuid.uuid4())[:8]
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)

    try:
        res = subprocess.run(['git', 'clone', '--depth', '1', repo_url, project_dir], capture_output=True, text=True, timeout=180)
        if res.returncode != 0:
            return False, f'git clone failed: {res.stderr}'
    except Exception as e:
        return False, f'git clone exception: {e}'

    if not os.path.exists(os.path.join(project_dir, 'Dockerfile')):
        return False, 'No Dockerfile found in repository.'

    if not subdomain:
        san_name = _sanitize(name)
        san_user = _sanitize(user)
        subdomain = f"{san_name}.{san_user}.localhost"

    image_tag = f'project_{project_id}:latest'
    # prefer human-friendly container name based on project name
    container_name = _sanitize(name)
    # rate limit and forward auth can be set via environment/data; default none/enabled
    # For now we don't enforce rate here unless caller passes environment variables via repo metadata
    ok, result = build_and_run(project_id, project_dir, image_tag, subdomain, cpu=cpu, memory=memory, container_name=container_name)
    if not ok:
        return False, result

    container_id = result
    db = load_db()
    db[project_id] = {
        'id': project_id,
        'name': name,
        'repo': repo_url,
        'owner_email': owner_email,
        'owner_token_contract': owner_token_contract,
        'dir': project_dir,
        'image': image_tag,
        'container_id': container_id,
        'subdomain': subdomain,
        'cpu': cpu,
        'memory': memory,
        'status': 'running',
        'created_at': now_iso(),
        'last_access': now_iso(),
        'last_started': now_iso(),
    }
    save_db(db)
    return True, {'id': project_id, 'container_id': container_id, 'subdomain': subdomain}


def stop_project(project_id):
    db = load_db()
    p = db.get(project_id)
    if not p:
        return False, 'not found'
    if docker is None:
        return False, 'docker sdk not available'
    client = docker.from_env()
    try:
        c = client.containers.get(p['container_id'])
        c.stop()
        p['status'] = 'stopped'
        # record when the container was stopped
        try:
            p['last_stopped'] = now_iso()
        except Exception:
            pass
        save_db(db)
        return True, 'stopped'
    except Exception as e:
        return False, str(e)


def start_project(project_id):
    db = load_db()
    p = db.get(project_id)
    if not p:
        return False, 'not found'
    if docker is None:
        return False, 'docker sdk not available'
    client = docker.from_env()
    try:
        c = client.containers.get(p['container_id'])
        c.start()
        p['status'] = 'running'
        p['last_access'] = now_iso()
        # record when the container was (re)started
        try:
            p['last_started'] = now_iso()
        except Exception:
            pass
        save_db(db)
        return True, 'started'
    except Exception as e:
        return False, str(e)


def project_status(project_id):
    db = load_db()
    p = db.get(project_id)
    if not p:
        return None
    return p


def touch_project(project_id):
    db = load_db()
    p = db.get(project_id)
    if not p:
        return False
    p['last_access'] = now_iso()
    save_db(db)
    return True


def delete_project(project_id):
    """Stop and remove the container, remove project files and delete DB entry."""
    db = load_db()
    p = db.get(project_id)
    if not p:
        return False, 'not found'

    # Try to stop and remove container if exists
    if docker is not None:
        client = docker.from_env()
        try:
            c = client.containers.get(p['container_id'])
            try:
                c.stop(timeout=5)
            except Exception:
                pass
            try:
                c.remove()
            except Exception:
                pass
        except Exception:
            # container may already be gone
            pass

    # Remove image (best-effort)
    if docker is not None:
        try:
            client = docker.from_env()
            try:
                client.images.remove(p.get('image'), force=True)
            except Exception:
                pass
        except Exception:
            pass

    # Remove project directory
    try:
        import shutil
        proj_dir = p.get('dir')
        if proj_dir and os.path.exists(proj_dir):
            # on Windows permission errors can prevent removal; provide an onerror handler
            def _on_rm_error(func, path, exc_info):
                try:
                    os.chmod(path, 0o777)
                    func(path)
                except Exception:
                    pass

            try:
                shutil.rmtree(proj_dir, onerror=_on_rm_error)
            except Exception as e:
                return False, f'failed to remove project directory: {e}'
    except Exception as e:
        return False, f'failed during project dir cleanup: {e}'

    # Remove from DB
    try:
        del db[project_id]
        save_db(db)
    except Exception as e:
        return False, f'error removing from db: {e}'

    return True, 'deleted'
