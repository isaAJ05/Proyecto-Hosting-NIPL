from flask import Blueprint, request, jsonify
import subprocess

containers_bp = Blueprint('containers', __name__)

@containers_bp.route('/is_docker_active')
def is_docker_active():
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=3
        )
        return jsonify({"active": result.returncode == 0})
    except Exception:
        return jsonify({"active": False})