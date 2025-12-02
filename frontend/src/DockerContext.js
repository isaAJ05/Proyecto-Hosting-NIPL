import React, { createContext, useState, useContext, useRef } from "react";

// Crear el contexto
const DockerContext = createContext();

// Proveedor del contexto
export const DockerProvider = ({ children }) => {
  const [dockerActive, setDockerActive] = useState(null);

  // Guard para evitar llamadas simultáneas
  const verifyingRef = useRef(false);

  // Función para verificar el estado de Docker y actualizar el estado.
  // Intenta varias veces con backoff para cubrir el caso en que Docker está arrancando.
  const verificarEstadoDocker = async (options = {}) => {
    const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 4; // intentos adicionales
    const baseDelay = typeof options.baseDelay === 'number' ? options.baseDelay : 1000;

    if (verifyingRef.current) {
      return dockerActive;
    }
    verifyingRef.current = true;
    console.log("Context: Consultando estado de Docker con reintentos...");
    try {
      let attempt = 0;
      let delay = baseDelay;
      while (attempt <= maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const res = await fetch("http://127.0.0.1:8000/containers/is_docker_active", { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setDockerActive(!!(data && data.active));
          return !!(data && data.active);
        } catch (err) {
          attempt += 1;
          if (attempt > maxRetries) {
            console.error("Error verificando Docker tras reintentos:", err);
            setDockerActive(false);
            return false;
          }
          // espera con backoff antes del siguiente intento
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 8000);
        }
      }
      setDockerActive(false);
      return false;
    } finally {
      verifyingRef.current = false;
    }
  };

  return (
    <DockerContext.Provider value={{ dockerActive, setDockerActive, verificarEstadoDocker }}>
      {children}
    </DockerContext.Provider>
  );
};

// Hook para usar el contexto
export const useDocker = () => useContext(DockerContext);