from flask import Flask
from auth.auth_routes import auth_bp
from containers.containers_routes import containers_bp
from projects.projects_routes import projects_bp
from cleanup import start_cleanup_thread
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://frontend:3000"])


# Registrar los Blueprints
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(containers_bp, url_prefix='/containers')
app.register_blueprint(projects_bp, url_prefix='/projects')

if __name__ == "__main__":
	# Start background cleaner: stop projects idle > 30 minutes, check every 5 minutes
	try:
		start_cleanup_thread(idle_seconds=30 * 60, interval_seconds=5 * 60)
	except Exception as e:
		print(f"Failed to start cleanup thread: {e}")
	app.run(host="0.0.0.0", port=8000, debug=True)
