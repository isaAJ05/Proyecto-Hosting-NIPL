Traefik local setup for Proyecto-Hosting-NIPL

This folder contains a docker-compose configuration to run Traefik as a local reverse proxy.

How it works

- Traefik listens on port 80 and uses the Docker provider to auto-discover containers and routes based on labels.
- Containers must be connected to the Docker network `traefik-net` and have labels similar to:

  labels:

  - "traefik.enable=true"
  - "traefik.http.routers.myrouter.rule=Host(`project.user.localhost`)"
  - "traefik.http.services.myrouter.loadbalancer.server.port=80"
  - "traefik.docker.network=traefik-net"

Usage

1. From the `proxy/` folder run:

   docker compose up -d

2. Verify Traefik dashboard at http://localhost:8080 (insecure, dev only)

Notes

- `acme.json` is included empty; if you enable LetsEncrypt in production ensure proper permissions (600) and a valid configuration.
- For local development we route to `*.localhost` hostnames which resolve to 127.0.0.1 in modern systems.
