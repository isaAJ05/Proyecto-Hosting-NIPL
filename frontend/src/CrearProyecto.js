"use client"

import { useState, useRef, useEffect } from "react"
import "./App.css"

function CrearProyecto({ onBack, lightTheme }) {
  const savedUser = sessionStorage.getItem("user")
  const userPanelRef = useRef(null)
  const [showUserPanel, setShowUserPanel] = useState(false)
  const [userPanelFade, setUserPanelFade] = useState(false)
  const [user, setUser] = useState(null)
  const [showRenewTokenToast, setShowRenewTokenToast] = useState(false)

  let email = ""
  if (savedUser) {
    try {
      const userObj = JSON.parse(savedUser)
      email = userObj.email || "Invitado"
    } catch (e) {
      email = "Invitado"
    }
  }

  // Mostrar solo la parte local del email (antes de @) en la UI
  const emailUserDisplay = (email || "usuario").split("@")[0].replace(/\s+/g, "") || "usuario"

  const [project, setProject] = useState({
    name: "",
    github_url: "",
    template: "",
    description: "",
    cpu: "1",
    memory: "512",
    rate_limit: "60",
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Información de los templates disponibles
  const templateInfo = {
    "html-static": {
      name: "Sitio Estático (HTML/CSS/JS)",
      description:
        "Template para sitios web estáticos sin frameworks. Ideal para páginas de aterrizaje, portfolios y documentación.",
      repository: "https://github.com/RogerMarenco/snake-main.git",
      structure: [
        "📄 Dockerfile",
        "📄 README.md",
        "📄 index.html",
        "📄 script.js",
        "📄 styles.css",
      ],
      dockerfile: `FROM nginx:alpine

# Copia todo el contenido del contexto de construcción al directorio de nginx
COPY . /usr/share/nginx/html

# Expone el puerto 80 (puerto interno del contenedor)
EXPOSE 80

# Ejecuta nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]`,
      instructions: [
        "1. Clona este template en tu repositorio de GitHub",
        "2. Modifica el contenido HTML/CSS/JS según tus necesidades",
        "3. Proporciona la URL de tu repositorio al crear el proyecto",
        "4. El sistema creará automáticamente un contenedor con Traefik",
        "5. Tu sitio estará disponible en: nombreProyecto.nombreUsuario.localhost",
      ],
    },
    react: {
      name: "Aplicación React",
      description:
        "Template para aplicaciones web modernas con React. Incluye configuración optimizada para desarrollo y producción.",
      repository: "https://github.com/isaAJ05/react.git",
      structure: [
        "📁 src/ - Código fuente React",
        "📁 public/ - Recursos públicos",
        "📁 package.json - Dependencias",
        "📁 vite.config.js - Configuración Vite",
      ],
      dockerfile: `FROM node:18-slim AS build
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar cache de Docker
COPY package*.json ./

# Usar npm ci si existe package-lock.json, si no cae back a npm install
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

# Copiar el resto del código y construir
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:18-slim
WORKDIR /app
RUN npm install -g serve@14.1.2
COPY --from=build /app/build ./build
EXPOSE 80
CMD ["serve", "-s", "build", "-l", "80"]`,
      instructions: [
        "1. Clona este template en tu repositorio de GitHub",
        "2. Ejecuta 'npm install' para instalar dependencias",
        "3. Desarrolla tu aplicación React en src/",
        "4. Proporciona la URL de tu repositorio al crear el proyecto",
        "5. El sistema construirá y desplegará tu app automáticamente",
      ],
    },
    nodejs: {
      name: "Flask con plantillas HTML",
      description:
        "Template para aplicaciones con Flask que sirven páginas con plantillas Jinja2 y recursos estáticos. Ideal para sitios y microservicios ligeros.",
      repository: "https://github.com/isaAJ05/flask.git",
      structure: [
        "📁 app.py - Punto de entrada de Flask (app)",
        "📁 templates/ - Plantillas Jinja2 (HTML)",
        "📁 static/ - Archivos estáticos (css, js, imágenes)",
        "📁 requirements.txt - Dependencias Python",
      ],
      dockerfile: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV FLASK_ENV=production
ENV FLASK_APP=app.py
EXPOSE 80
CMD ["gunicorn", "--bind", "0.0.0.0:80", "app:app"]`,
      instructions: [
        "1. Clona este template en tu repositorio de GitHub",
        "2. Añade tus plantillas HTML en la carpeta templates/ y recursos en static/",
        "3. Define dependencias en requirements.txt (Flask, gunicorn, etc.)",
        "4. Proporciona la URL de tu repositorio al crear el proyecto",
        "5. El sistema construirá la imagen y lanzará el contenedor (será accesible en el subdominio asignado)",
      ],
    },
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!project.name.trim() || !project.github_url.trim() || !project.template.trim()) {
      setError("El nombre, URL del repositorio y template son obligatorios")
      return
    }

    // Validar formato de URL de GitHub
    if (!project.github_url.includes("github.com")) {
      setError("La URL debe ser un repositorio válido de GitHub")
      return
    }

    if (!project.cpu || Number.parseFloat(project.cpu) <= 0) {
      setError("El número de CPU cores debe ser mayor a 0")
      return
    }

    if (!project.memory || Number.parseInt(project.memory) <= 0) {
      setError("La memoria asignada debe ser mayor a 0 MB")
      return
    }

    if (!project.rate_limit || Number.parseInt(project.rate_limit) <= 0) {
      setError("El rate limit debe ser mayor a 0 peticiones por minuto")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const token = sessionStorage.getItem("accessToken")
      const tokenContract = sessionStorage.getItem("tokenContract") || ""

      // Construir subdominio usando solo la parte local del email (antes de @)
      const emailUser = (email || 'Invitado').split('@')[0].replace(/\s+/g, '') || 'usuario'
      const subdomain = `${project.name || 'proyecto'}.${emailUser}.localhost`

      const res = await fetch("http://127.0.0.1:8000/projects/deploy", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: `Bearer ${token}` } : {}),
        body: JSON.stringify({
          name: project.name,
          repo_url: project.github_url,
          // `user` envía solo el nombre (parte antes de @). `owner_email` mantiene el correo completo.
          user: emailUser || 'Invitado',
          owner_email: email || 'Invitado',
          token_contract: tokenContract,
          subdomain: subdomain,
          cpu: Number.parseFloat(project.cpu),
          // En el backend `memory` se usa como mem_limit, espera algo como '512m'
          memory: `${Number.parseInt(project.memory)}m`,
          rate_limit_per_minute: Number.parseInt(project.rate_limit),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess("¡Proyecto creado exitosamente! Desplegando contenedor...")
        setTimeout(() => {
          onBack() // Regresar al panel principal
        }, 2000)
      } else {
        setError(data.error || (data.message || "Error al crear el proyecto"))
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor")
    } finally {
      setIsLoading(false)
    }
  }

  // Determinar si la configuración está completa
  const configCompleta = project.name.trim() && project.github_url.trim() && project.template.trim()

  useEffect(() => {
    function handleClickOutside(event) {
      if (userPanelRef.current && !userPanelRef.current.contains(event.target)) {
        setShowUserPanel(false)
      }
    }

    if (showUserPanel) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showUserPanel])

  return (
    <div
      className={`app-container${lightTheme ? " light-theme" : ""}`}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: lightTheme ? "#f8f9fa" : "#323232",
      }}
    >
      <nav className="navbar">
        <button
          className="toggle-history-btn"
          onClick={onBack}
          title="Volver al panel principal"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {/* Icono de casita */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 10.5L12 3l9 7.5V21a1.5 1.5 0 01-1.5 1.5H4.5A1.5 1.5 0 013 21V10.5zM9 21V12h6v9"
            />
          </svg>
          <img
            src="/hm_logoWIDTH.png"
            alt="Logo Hosting"
            style={{ height: 44, marginLeft: 12, borderRadius: 12 }}
          />
        </button>
        <h1>Crear Proyecto de Hosting</h1>
        <button
          style={{
            marginLeft: "auto",
            background: lightTheme ? "#fff" : "#131313",
            color: lightTheme ? "#323232" : "#fff",
            border: "none",
            borderRadius: 50,
            padding: 8,
            fontWeight: 600,
            fontSize: 18,
            cursor: "pointer",
            boxShadow: "none",
            transition: "background 0.3s, color 0.3s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
          onClick={() => setShowUserPanel((v) => !v)}
          title="Usuario"
          onMouseOver={(e) => (e.currentTarget.style.background = "#323232")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#131313")}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        </button>
        {showUserPanel && (
          <div
            ref={userPanelRef}
            style={{
              position: "absolute",
              top: 48,
              right: 0,
              background: lightTheme ? "#fff" : "#131313",
              color: lightTheme ? "#323232" : "#fff",
              border: `1.5px solid ${lightTheme ? "#5b009b" : "#fff"}`,
              borderRadius: 8,
              boxShadow: "0 4px 24px #000a",
              minWidth: 180,
              zIndex: 100,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 16,
                marginBottom: 2,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
              {(user && (user.username || user.name || user.email)) || "Invitado"}
            </div>
            <div style={{ fontSize: 13, color: lightTheme ? "#656d76" : "#b3b3b3", marginBottom: 6, marginLeft: 28 }}>
              Project ID: {sessionStorage.getItem("tokenContract") || "N/A"}
            </div>
            <button
              style={{
                background: "#c196ff",
                color: "#131313",
                border: "none",
                borderRadius: 6,
                padding: "8px 0",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                transition: "background 0.2s",
                marginBottom: 8,
              }}
              onClick={async () => {
                try {
                  const email = ((user && (user.username || user.name || user.email)) || "").trim().toLowerCase()
                  const pass = sessionStorage.getItem("userPassword") || ""
                  const token = sessionStorage.getItem("tokenContract") || ""
                  const res = await fetch("http://127.0.0.1:5000/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.JSON.stringify({
                      email,
                      password: pass,
                      token_contract: token,
                    }),
                  })
                  const data = await res.json()
                  if (res.ok && data.accessToken) {
                    sessionStorage.setItem("accessToken", data.accessToken)
                    setShowRenewTokenToast(true)
                    setTimeout(() => setShowRenewTokenToast(false), 2000)
                  } else {
                    alert(data.error || "No se pudo renovar el token")
                  }
                } catch (err) {
                  alert("No se pudo conectar con el backend")
                }
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#b377f7")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#c196ff")}
            >
              Renovar token
            </button>
            <button
              style={{
                background: "#5b009b",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 0",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onClick={() => {
                setUserPanelFade(true)
                setTimeout(() => {
                  setShowUserPanel(false)
                  setUserPanelFade(false)
                  setUser(null)
                  sessionStorage.removeItem("user")
                }, 350)
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#3d0068")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#5b009b")}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </nav>

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Panel izquierdo - Configuración del Proyecto */}
        <div
          style={{
            width: "380px",
            background: lightTheme ? "#fff" : "#131313",
            borderRight: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
            padding: "20px 16px",
            overflow: "auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header de configuración */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#c196ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#131313",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              1
            </div>
            <span
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: lightTheme ? "#1f2328" : "#fff",
              }}
            >
              Configuración del Proyecto
            </span>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: configCompleta ? "#34d399" : lightTheme ? "#e1e4e8" : "#23272e",
                border: configCompleta ? "none" : `2px solid ${lightTheme ? "#b1b1b1" : "#444"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "auto",
                transition: "background 0.2s, border 0.2s",
              }}
            >
              {configCompleta ? (
                <svg width="10" height="10" fill="#fff" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  />
                </svg>
              ) : null}
            </div>
          </div>

          {/* Formulario */}
          <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
            <form onSubmit={handleSubmit}>
              {/* Nombre del Proyecto */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    color: lightTheme ? "#656d76" : "#8b949e",
                  }}
                >
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => setProject((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="mi-proyecto-web"
                  style={{
                    width: "95%",
                    padding: "7px 10px",
                    border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                    borderRadius: 4,
                    background: lightTheme ? "#fff" : "#1c1c1c",
                    color: lightTheme ? "#1f2328" : "#e6edf3",
                    fontSize: 13,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                  }}
                  required
                />
                <div
                  style={{
                    marginTop: 4,
                    color: lightTheme ? "#656d76" : "#8b949e",
                    fontSize: 11,
                  }}
                >
                  Tu proyecto estará disponible en:{" "}
                  <strong>
                    {project.name || "nombre"}.{emailUserDisplay || "usuario"}.localhost
                  </strong>
                </div>
              </div>

              {/* URL del Repositorio GitHub */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    color: lightTheme ? "#656d76" : "#8b949e",
                  }}
                >
                  URL del Repositorio GitHub *
                </label>
                <input
                  type="url"
                  value={project.github_url}
                  onChange={(e) => setProject((prev) => ({ ...prev, github_url: e.target.value }))}
                  placeholder="https://github.com/usuario/mi-repo.git"
                  style={{
                    width: "95%",
                    padding: "7px 10px",
                    border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                    borderRadius: 4,
                    background: lightTheme ? "#fff" : "#1c1c1c",
                    color: lightTheme ? "#1f2328" : "#e6edf3",
                    fontSize: 13,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                  }}
                  required
                />
                <div
                  style={{
                    marginTop: 4,
                    color: lightTheme ? "#656d76" : "#8b949e",
                    fontSize: 11,
                  }}
                >
                  URL del repositorio que contiene tu proyecto modificado
                </div>
              </div>

              {/* Template Base */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    color: lightTheme ? "#656d76" : "#8b949e",
                  }}
                >
                  Template Base *
                </label>
                <select
                  value={project.template}
                  onChange={(e) => setProject((prev) => ({ ...prev, template: e.target.value }))}

                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                    borderRadius: 4,
                    background: lightTheme ? "#fff" : "#1c1c1c",
                    color: lightTheme ? "#1f2328" : "#e6edf3",
                    fontSize: 13,
                  }}
                  required
                >
                  <option value="">Seleccionar template</option>
                  <option value="html-static">Sitio Estático (HTML/CSS/JS)</option>
                  <option value="react">Aplicación React</option>
                  <option value="nodejs">Flask con plantillas HTML</option>
                </select>
                <div
                  style={{
                    marginTop: 4,
                    color: lightTheme ? "#656d76" : "#8b949e",
                    fontSize: 11,
                  }}
                >
                  Selecciona el tipo de template que clonaste y modificaste
                </div>
              </div>

              {/* Descripción (opcional) eliminada intencionalmente */}

              <div
                style={{
                  borderTop: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
                  paddingTop: 16,
                  marginTop: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    marginBottom: 12,
                    fontWeight: 600,
                    fontSize: 13,
                    color: lightTheme ? "#1f2328" : "#fff",
                  }}
                >
                  ⚙️ Configuración de Recursos
                </div>

                {/* CPU Cores */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 500,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                    }}
                  >
                    CPU (cores) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="4"
                    value={project.cpu}
                    onChange={(e) => setProject((prev) => ({ ...prev, cpu: e.target.value }))}
                    placeholder="1"
                    style={{
                      width: "95%",
                      padding: "7px 10px",
                      border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                      borderRadius: 4,
                      background: lightTheme ? "#fff" : "#1c1c1c",
                      color: lightTheme ? "#1f2328" : "#e6edf3",
                      fontSize: 13,
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                    }}
                    required
                  />
                  <div
                    style={{
                      marginTop: 4,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      fontSize: 11,
                    }}
                  >
                    Número de cores de CPU asignados al contenedor (0.5 - 4)
                  </div>
                </div>

                {/* Memoria */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 500,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                    }}
                  >
                    Memoria (MB) *
                  </label>
                  <input
                    type="number"
                    step="128"
                    min="256"
                    max="2048"
                    value={project.memory}
                    onChange={(e) => setProject((prev) => ({ ...prev, memory: e.target.value }))}
                    placeholder="512"
                    style={{
                      width: "95%",
                      padding: "7px 10px",
                      border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                      borderRadius: 4,
                      background: lightTheme ? "#fff" : "#1c1c1c",
                      color: lightTheme ? "#1f2328" : "#e6edf3",
                      fontSize: 13,
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                    }}
                    required
                  />
                  <div
                    style={{
                      marginTop: 4,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      fontSize: 11,
                    }}
                  >
                    Memoria RAM asignada al contenedor en MB (256 - 2048)
                  </div>
                </div>

                {/* Rate Limit */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 500,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                    }}
                  >
                    Rate Limit (peticiones/min) *
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="10"
                    max="1000"
                    value={project.rate_limit}
                    onChange={(e) => setProject((prev) => ({ ...prev, rate_limit: e.target.value }))}
                    placeholder="60"
                    style={{
                      width: "95%",
                      padding: "7px 10px",
                      border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                      borderRadius: 4,
                      background: lightTheme ? "#fff" : "#1c1c1c",
                      color: lightTheme ? "#1f2328" : "#e6edf3",
                      fontSize: 13,
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                    }}
                    required
                  />
                  <div
                    style={{
                      marginTop: 4,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      fontSize: 11,
                    }}
                  >
                    Número máximo de peticiones por minuto permitidas (10 - 1000)
                  </div>
                </div>
              </div>

              {/* Nota importante sobre recursos */}
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 16,
                  color: lightTheme ? "#b59b00" : "#ffe066",
                  background: lightTheme ? "#fffbe6" : "#3a3a1c",
                  borderRadius: 4,
                  padding: "10px 12px",
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                <strong>⚡ Control de Recursos:</strong> Tu contenedor tendrá límites de CPU y memoria. Si está inactivo
                por 30 minutos, se apagará automáticamente y se reiniciará al recibir una nueva petición.
              </div>

              {/* Mensajes de estado */}
              {error && (
                <div
                  style={{
                    color: "#f85149",
                    background: lightTheme ? "#ffebe9" : "#490202",
                    border: `1px solid ${lightTheme ? "#ffb3ba" : "#f85149"}`,
                    borderRadius: 4,
                    padding: 10,
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    color: "#238636",
                    background: lightTheme ? "#dafbe1" : "#0f5132",
                    border: `1px solid ${lightTheme ? "#34d399" : "#238636"}`,
                    borderRadius: 4,
                    padding: 10,
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  {success}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Panel derecho - Información del Template */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header del panel derecho */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 20px",
              background: lightTheme ? "#fff" : "#131313",
              borderBottom: `1px solid ${lightTheme ? "#e1e4e8" : "#131313"}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#c196ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#131313",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                2
              </div>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: lightTheme ? "#1f2328" : "#fff",
                }}
              >
                Información del Template
              </span>
            </div>
          </div>

          {/* Contenido del panel derecho */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px",
              background: lightTheme ? "#f6f8fa" : "#1c1c1c",
            }}
          >
            {project.template && templateInfo[project.template] ? (
              <div>
                {/* Nombre del template */}
                <div
                  style={{
                    background: lightTheme ? "#fff" : "#131313",
                    border: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
                    borderRadius: 6,
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: 8,
                      fontSize: 16,
                      fontWeight: 600,
                      color: lightTheme ? "#1f2328" : "#fff",
                    }}
                  >
                    {templateInfo[project.template].name}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      lineHeight: 1.5,
                    }}
                  >
                    {templateInfo[project.template].description}
                  </p>
                </div>

                <div
                  style={{
                    background: lightTheme ? "#fff" : "#131313",
                    border: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
                    borderRadius: 6,
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: lightTheme ? "#1f2328" : "#fff",
                    }}
                  >
                    📂 Repositorio Base del Template
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      marginBottom: 8,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      lineHeight: 1.5,
                    }}
                  >
                    Clona este repositorio en tu cuenta de GitHub antes de modificarlo:
                  </p>
                  <a
                    href={templateInfo[project.template].repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: lightTheme ? "#f6f8fa" : "#0d1117",
                      border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                      borderRadius: 4,
                      color: "#c196ff",
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: "none",
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    {templateInfo[project.template].repository}
                  </a>
                </div>

                {/* Estructura del proyecto */}
                <div
                  style={{
                    background: lightTheme ? "#fff" : "#131313",
                    border: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
                    borderRadius: 6,
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: lightTheme ? "#1f2328" : "#fff",
                    }}
                  >
                    📦 Estructura del Proyecto
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      paddingLeft: 20,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      lineHeight: 1.8,
                    }}
                  >
                    {templateInfo[project.template].structure.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Instrucciones de despliegue */}
                <div
                  style={{
                    background: lightTheme ? "#fff" : "#131313",
                    border: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
                    borderRadius: 6,
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: lightTheme ? "#1f2328" : "#fff",
                    }}
                  >
                    🚀 Instrucciones de Despliegue
                  </h4>
                  <ol
                    style={{
                      margin: 0,
                      padding: 0,
                      paddingLeft: 20,
                      fontSize: 13,
                      color: lightTheme ? "#656d76" : "#8b949e",
                      lineHeight: 1.8,
                    }}
                  >
                    {templateInfo[project.template].instructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                </div>

                {/* Dockerfile del template (solo lectura) */}
                <div
                  style={{
                    background: lightTheme ? "#fff" : "#131313",
                    border: `1px solid ${lightTheme ? "#e1e4e8" : "#1c1c1c"}`,
                    borderRadius: 6,
                    padding: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: lightTheme ? "#1f2328" : "#fff",
                    }}
                  >
                    🐳 Dockerfile (Solo lectura)
                  </h4>
                  <pre
                    style={{
                      margin: 0,
                      padding: "12px",
                      background: lightTheme ? "#f6f8fa" : "#0d1117",
                      border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                      borderRadius: 4,
                      fontSize: 12,
                      color: lightTheme ? "#1f2328" : "#e6edf3",
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                      overflow: "auto",
                      lineHeight: 1.5,
                    }}
                  >
                    {templateInfo[project.template].dockerfile}
                  </pre>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: lightTheme ? "#656d76" : "#8b949e",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                <div>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ margin: "0 auto 12px" }}
                  >
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  <p style={{ margin: 0 }}>
                    Selecciona un template para ver
                    <br />
                    más información y ejemplos
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer con botones */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              background: lightTheme ? "#f6f8fa" : "#131313",
              borderTop: `1px solid ${lightTheme ? "#e1e4e8" : "#1C1C1C"}`,
              flexShrink: 0,
            }}
          >
            <div></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onBack}
                style={{
                  background: "#1c1c1c",
                  color: lightTheme ? "#e0e0e0ff" : "#e0e0e0ff",
                  border: `1px solid ${lightTheme ? "#d1d9e0" : "#1c1c1c"}`,
                  borderRadius: 4,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#323232")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#1c1c1c")}
              >
                Cancelar
              </button>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                style={{
                  background: isLoading ? "#6c757d" : "#c196ff",
                  color: "#131313",
                  border: "none",
                  borderRadius: 4,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseOver={(e) => !isLoading && (e.currentTarget.style.background = "#b377f7")}
                onMouseOut={(e) => !isLoading && (e.currentTarget.style.background = "#c196ff")}
              >
                {isLoading ? (
                  <>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTop: "2px solid #fff",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Creando...
                  </>
                ) : (
                  "Crear Proyecto"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer" style={{ margin: 0 }}>
        <div>
          Host Me &copy; 2025 &nbsp;&nbsp; <span style={{ fontWeight: 600 }}></span>
        </div>
        <div>
          <span>Contacto: oakservicesglobal@gmail.com</span>
        </div>
      </footer>

      {/* Toast de renovación de token */}
      {showRenewTokenToast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "#34d399",
            color: "#131313",
            padding: "12px 20px",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 1000,
            animation: "slideIn 0.3s ease-out",
          }}
        >
          ✓ Token renovado exitosamente
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export default CrearProyecto
