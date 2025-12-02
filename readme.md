# ❄️HOST ME ;)

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Roble](https://img.shields.io/badge/Roble-000000?style=for-the-badge&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![Traefik](https://img.shields.io/badge/Traefik-24A1C1?style=for-the-badge&logo=traefikproxy&logoColor=white)
---
### Proyecto realizado por:
Isabella Arrieta, Natalia Carpintero, Roger Marenco, Paula Núñez y Luis Robles.

## 🎥 Video de presentación
📌 **YouTube:** https://www.youtube.com/watch?v=cM5YTzYSCn0

---
## 📁 Templates Dockerizados

| Tipo | Repositorio |
|------|-------------|
| **Sitio estático** | https://github.com/RogerMarenco/snake-main.git |
| **Aplicación React** | https://github.com/isaAJ05/react.git |
| **Flask con plantillas HTML** | https://github.com/isaAJ05/flask.git |

---
## 🚀 Ejecución del Proyecto

**🟦 Backend**
```bash
cd backend/app
python server.py
```

**🟩 Frontend**
```bash
npm install
npm run start
```

**🟧 Proxy (Traefik)**
```bash
docker network create traefik-net
docker compose up -d
docker network connect traefik-net proyecto_traefik
```

**🐳 Docker (Despliegue completo)** 
```bash
docker network create traefik-net
docker compose up --build -d
```

---
## 📘 Documento Técnico
Este proyecto implementa una **plataforma de hosting dinámico basada en contenedores Docker**, donde los usuarios pueden:

- Autenticarse mediante JWT  
- Registrar proyectos basados en templates de frameworks web  
- Desplegar automáticamente un contenedor aislado para cada proyecto  
- Recibir un subdominio único accesible desde el navegador  
- Monitorear el estado, recursos, logs y tiempo de ejecución  
- Detener, iniciar o eliminar cada contenedor bajo demanda  
---

## 🏗️ Arquitectura y Componentes del Sistema 

La plataforma está compuesta por varios subsistemas que cooperan entre sí:

**🎨 Frontend (React)**
- Interfaz de usuario intuitiva  
- Autenticación  
- Gestión de proyectos  
- Acciones: iniciar, detener, abrir, reiniciar, eliminar  

**🧠 Backend (Flask)**
- API REST principal  
- Gestión de contenedores con Docker 
- Registro y persistencia de proyectos  
- Asignación de subdominios  
- Validación de usuarios  
- Límites de recursos para cada contenedor  

**🐳 Motor Docker**
- Construcción de imágenes desde templates  
- Ejecución y aislamiento completo por contenedor  
- Configuración de CPU y memoria  
- Gestión del ciclo de vida completo  

**🌐 Reverse Proxy (Traefik)**
- Redirección dinámica de subdominios  
- Aislamiento de tráfico por contenedor  
- Headers de seguridad y optimización  

**📡 Sistema de Monitoreo**
- CPU, RAM, tiempo de actividad  
- Estado de contenedores  
- Última actividad  

**🔐 Servicio de Autenticación**
- Manejo de tokens JWT  
- Validación en endpoints protegidos  
- Sesiones seguras  

**📦 Gestor de Contenedores**
- Creación, arranque, apagado y eliminación  
- Límite de CPU  
- Límite de memoria  
- Recolección de métricas  
- Subdominios únicos  
- Asignación dinámica de puertos  

**🧩 Templates Dockerizados**

Frameworks soportados:
- React  
- Flask  
- Plantillas mínimas  
- Otros frameworks simples  

Cada template incluye:
- Dockerfile optimizado  
- Servidor interno  
- Configuración lista para producción  

**🗄️ Base de datos**

Archivo `projects.json` que almacena:
- Proyectos  
- Estado  
- Recursos  
- Última actividad  

---

## 🔁 Flujo de Trabajo del Sistema

**1. Autenticación**

   El usuario inicia sesión mediante credenciales. El sistema valida y genera un token JWT que se incluye en todas las peticiones posteriores.

**2. Creación de proyecto / Selección de template**

   El usuario selecciona un template para su proyecto, el cual deberá clonar en Github. El sistema identifica la imagen Docker correspondiente a la información recibida.

**3. Registro del proyecto**

   Se crea un registro en la base de datos con información del proyecto: nombre, usuario propietario, framework seleccionado y configuración inicial. Se guarda la información en `projects.json`.

**4. Construcción del contenedor**  

   Docker Engine crea un contenedor aislado correspondiente. Se configuran límites de recursos, puertos y volúmenes de almacenamiento.

**5. Asignación de subdominio**  

   Traefik detecta labels, aplica middlewares de rate-limit y forward-auth.

**6. Acceso y administración**  

   El proyecto queda disponible en el subdominio asignado. El usuario puede abrir, detener, iniciar o eliminar su contenedor.

---

## 🔒Estrategias de Seguridad

- Autenticación JWT con expiración.
- Validaciones por petición mediante middleware.
- Redes aisladas e independientes por contenedor, sin acceso compartido.
- Validación y saneamiento de todas las entradas antes de procesarse.
- Auditoría de eventos críticos.
- Headers HTTP seguros.
- Configuración de CORS para orígenes permitidos.
- Notificaciones de alerta ante comportamientos no autorizados.  
---

## ⚙️ Optimización de Recursos
La plataforma implementa múltiples estrategias para garantizar un uso eficiente de recursos del servidor, permitiendo alojar múltiples proyectos simultáneamente sin degradación del rendimiento

- Uso de `nano_cpus` y `mem_limit` al crear contenedores.
- Rate limit por proyecto aplicado vía middlewares de Traefik.
- Apagado automático `idle` y limpieza periódica de archivos temporales y caché para liberar recursos.
- Priorización de contenedores activos.
  
 



