import React, { createContext, useState, useContext } from "react";

// Crear el contexto
const DockerContext = createContext();

// Proveedor del contexto
export const DockerProvider = ({ children }) => {
  const [dockerActive, setDockerActive] = useState(null);

  return (
    <DockerContext.Provider value={{ dockerActive, setDockerActive }}>
      {children}
    </DockerContext.Provider>
  );
};

// Hook para usar el contexto
export const useDocker = () => useContext(DockerContext);