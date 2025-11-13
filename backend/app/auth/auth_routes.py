from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
import os
import requests

# Cargar las variables de entorno desde el archivo .env
load_dotenv()
ROBLE_EMAIL = os.getenv("email")
ROBLE_PASSWORD = os.getenv("password")

auth_bp = Blueprint('auth', __name__)
# para iniciar sesion:
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    token_contract = data.get('token_contract')
    # Si el usuario es 'Invitado' o vacío, usar credenciales del .env
    if not email or email.strip().lower() == 'invitado':
        email = ROBLE_EMAIL
        password = ROBLE_PASSWORD
    print("Credenciales recibidas:", email, password, token_contract)
    res = requests.post(
        f"https://roble-api.openlab.uninorte.edu.co/auth/{token_contract}/login",
        json={"email": email, "password": password}
    )
    login_data = res.json()
    access_token = login_data.get("accessToken")
    print("AccessToken recibido:", access_token) # Depuración
    if not access_token:
        return jsonify({"error": "Credenciales inválidas"}), 401
    return jsonify({"accessToken": access_token})

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    token_contract = data.get('token_contract')
    print("Datos de registro recibidos:", email, name, token_contract)
    res = requests.post(
        f"https://roble-api.openlab.uninorte.edu.co/auth/{token_contract}/signup-direct",
        json={"email": email, "password": password, "name": name}
    )
    if res.status_code != 200:
        return jsonify({"error": "Error en el registro"}), res.status_code
    return jsonify({"message": "Registro exitoso"}), 200





