from flask import Blueprint, request, jsonify
from models.project_models import create_project_from_repo, load_db, stop_project, start_project, project_status, touch_project, delete_project

projects_bp = Blueprint('projects_bp', __name__)


@projects_bp.route('/', methods=['GET'])
def list_projects():
    db = load_db()
    # optional filtering by owner_email and token_contract via query params OR headers
    owner_email = request.headers.get('X-Owner-Email') or request.headers.get('x-owner-email')
    token_contract = request.headers.get('X-Token-Contract') or request.headers.get('x-token-contract')
    print("Listing projects for owner_email:", owner_email, "and token_contract:", token_contract)
    if owner_email:
        filtered = {pid: p for pid, p in db.items() if p.get('owner_email') == owner_email and (token_contract is None or p.get('owner_token_contract') == token_contract)}
        return jsonify(filtered)
    return jsonify(db)


@projects_bp.route('/deploy', methods=['POST'])
def deploy_from_repo():
    """Deploy a project given a repo URL and a project name.
    JSON expected: { name, repo_url, user (optional), subdomain (optional), cpu, memory }
    """
    data = request.get_json() or {}
    name = data.get('name')
    repo_url = data.get('repo_url')
    user = data.get('user') or 'anon'
    owner_email = data.get('owner_email')
    owner_token_contract = data.get('token_contract')
    subdomain = data.get('subdomain')
    cpu = data.get('cpu')
    memory = data.get('memory')

    if not name or not repo_url:
        return jsonify({'error': 'name and repo_url are required'}), 400

    # Optionally accept rate_limit_per_minute in the request body
    rate_limit_per_minute = data.get('rate_limit_per_minute')
    ok, result = create_project_from_repo(repo_url, name, user=user, subdomain=subdomain, cpu=cpu, memory=memory, owner_email=owner_email, owner_token_contract=owner_token_contract)
    if not ok:
        return jsonify({'error': result}), 500

    return jsonify(result), 201


@projects_bp.route('/<project_id>/forward_auth', methods=['GET', 'POST'])
def forward_auth(project_id):
    """Endpoint intended for Traefik ForwardAuth middleware.
    When Traefik queries this endpoint before forwarding a request, we ensure the project container is running
    and update last_access. Return 200 to allow forwarding.
    """
    db = load_db()
    p = db.get(project_id)
    if not p:
        return jsonify({'error': 'not found'}), 404
    # If container is stopped, start it in background to avoid blocking Traefik
    if p.get('status') != 'running':
        try:
            from threading import Thread

            def _start():
                try:
                    start_project(project_id)
                except Exception:
                    pass

            Thread(target=_start, daemon=True).start()
        except Exception:
            # If we cannot spawn a background thread, attempt a best-effort start (non-blocking)
            try:
                start_project(project_id)
            except Exception:
                pass

    # touch last_access so cleaner knows this project is being used
    try:
        touch_project(project_id)
    except Exception:
        pass

    # Return 200 immediately; Traefik will forward the request to the project's container.
    # Note: container may still be starting; Traefik will receive connection errors if container
    # is not yet ready. Consider implementing healthchecks or readiness probes in the project.
    return jsonify({'allow': True}), 200


@projects_bp.route('/<project_id>/stop', methods=['POST'])
def stop_project_route(project_id):
    # authorization: require owner headers to match stored owner
    owner_email = request.headers.get('X-Owner-Email') or request.json.get('owner_email') if request.is_json else None
    token_contract = request.headers.get('X-Token-Contract') or request.json.get('token_contract') if request.is_json else None
    print("Stop request for project:", project_id, "by", owner_email, token_contract)
    db = load_db()
    p = db.get(project_id)
    if not p:
        return jsonify({'error': 'not found'}), 404
    if p.get('owner_email') and owner_email and p.get('owner_email') != owner_email:
        return jsonify({'error': 'forbidden'}), 403
    if p.get('owner_token_contract') and token_contract and p.get('owner_token_contract') != token_contract:
        return jsonify({'error': 'forbidden'}), 403
    ok, res = stop_project(project_id)
    if not ok:
        return jsonify({'error': res}), 500
    return jsonify({'result': res})


@projects_bp.route('/<project_id>/start', methods=['POST'])
def start_project_route(project_id):
    owner_email = request.headers.get('X-Owner-Email') or request.json.get('owner_email') if request.is_json else None
    token_contract = request.headers.get('X-Token-Contract') or request.json.get('token_contract') if request.is_json else None
    db = load_db()
    p = db.get(project_id)
    if not p:
        return jsonify({'error': 'not found'}), 404
    if p.get('owner_email') and owner_email and p.get('owner_email') != owner_email:
        return jsonify({'error': 'forbidden'}), 403
    if p.get('owner_token_contract') and token_contract and p.get('owner_token_contract') != token_contract:
        return jsonify({'error': 'forbidden'}), 403
    ok, res = start_project(project_id)
    if not ok:
        return jsonify({'error': res}), 500
    return jsonify({'result': res})


@projects_bp.route('/<project_id>/status', methods=['GET'])
def project_status_route(project_id):
    p = project_status(project_id)
    if not p:
        return jsonify({'error': 'not found'}), 404
    # Try to augment with real container info from Docker if available
    docker_info = {}
    try:
        try:
            import docker
        except Exception:
            docker = None

        container_id = p.get('container_id')
        if container_id and docker is not None:
            client = docker.from_env()
            try:
                c = client.containers.get(container_id)
                # c.attrs contains inspection data
                attrs = c.attrs
                started_at = attrs.get('State', {}).get('StartedAt')
                # compute running seconds if possible
                running_seconds = None
                if started_at:
                    from datetime import datetime
                    try:
                        # parse ISO and compute seconds
                        started_dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                        running_seconds = (datetime.utcnow().replace(tzinfo=started_dt.tzinfo) - started_dt).total_seconds()
                    except Exception:
                        running_seconds = None
                docker_info = {'docker_started_at': started_at, 'docker_running_seconds': running_seconds}
            except Exception:
                # try fallback to CLI inspect
                try:
                    import subprocess, json
                    res = subprocess.run(['docker', 'inspect', container_id], capture_output=True, text=True, timeout=5)
                    if res.returncode == 0:
                        arr = json.loads(res.stdout)
                        if arr and isinstance(arr, list):
                            state = arr[0].get('State', {})
                            started_at = state.get('StartedAt')
                            docker_info = {'docker_started_at': started_at}
                except Exception:
                    pass
    except Exception:
        docker_info = {}

    out = dict(p)
    out.update(docker_info)
    return jsonify(out)


@projects_bp.route('/<project_id>/touch', methods=['POST'])
def touch_project_route(project_id):
    ok = touch_project(project_id)
    if not ok:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'result': 'touched'})


@projects_bp.route('/<project_id>', methods=['DELETE'])
def delete_project_route(project_id):
    owner_email = request.headers.get('X-Owner-Email') or (request.json.get('owner_email') if request.is_json else None)
    token_contract = request.headers.get('X-Token-Contract') or (request.json.get('token_contract') if request.is_json else None)
    db = load_db()
    p = db.get(project_id)
    if not p:
        return jsonify({'error': 'not found'}), 404
    if p.get('owner_email') and owner_email and p.get('owner_email') != owner_email:
        return jsonify({'error': 'forbidden'}), 403
    if p.get('owner_token_contract') and token_contract and p.get('owner_token_contract') != token_contract:
        return jsonify({'error': 'forbidden'}), 403
    ok, res = delete_project(project_id)
    if not ok:
        return jsonify({'error': res}), 500
    return jsonify({'result': res})
