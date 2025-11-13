try:
    import docker
except Exception:
    docker = None
    
def build_and_run(project_id, project_dir, image_tag, subdomain, cpu=None, memory=None, container_name=None, rate_limit_per_minute=None, enable_forward_auth=True):
    if docker is None:
        return False, 'docker SDK not installed'
    client = docker.from_env()
    try:
        image, logs = client.images.build(path=project_dir, tag=image_tag)
    except Exception as e:
        return False, f'Error building image: {e}'

    labels = {}
    if subdomain:
        router_name = f'proj_{project_id}'
        labels['traefik.enable'] = 'true'
        labels[f'traefik.http.routers.{router_name}.rule'] = f'Host(`{subdomain}`)'
        labels[f'traefik.http.services.{router_name}.loadbalancer.server.port'] = '80'
        labels['traefik.docker.network'] = 'traefik-net'
        # Rate limiting via Traefik middleware (if provided)
        if rate_limit_per_minute:
            try:
                avg_per_sec = float(rate_limit_per_minute) / 60.0
                # Traefik expects average as a number (requests per second)
                labels[f'traefik.http.middlewares.{router_name}-ratelimit.rateLimit.average'] = str(avg_per_sec)
                # burst: allow some extra; use 10% of per-minute as burst or at least 1
                burst = max(1, int(int(rate_limit_per_minute) // 10))
                labels[f'traefik.http.middlewares.{router_name}-ratelimit.rateLimit.burst'] = str(burst)
                # attach middleware to router (forwardauth will be added too)
                labels[f'traefik.http.routers.{router_name}.middlewares'] = f'{router_name}-ratelimit@docker'
            except Exception:
                pass
        # ForwardAuth: ensure Traefik calls backend before forwarding so backend can start container if stopped
        if enable_forward_auth:
            # Traefik (inside docker) can reach the host via host.docker.internal on Docker Desktop
            forward_url = f'http://host.docker.internal:8000/projects/{project_id}/forward_auth'
            labels[f'traefik.http.middlewares.{router_name}-forwardauth.forwardauth.address'] = forward_url
            labels[f'traefik.http.middlewares.{router_name}-forwardauth.forwardauth.trustForwardHeader'] = 'true'
            # append forwardauth to middlewares list
            existing_middlewares = labels.get(f'traefik.http.routers.{router_name}.middlewares')
            if existing_middlewares:
                labels[f'traefik.http.routers.{router_name}.middlewares'] = existing_middlewares + ',' + f'{router_name}-forwardauth@docker'
            else:
                labels[f'traefik.http.routers.{router_name}.middlewares'] = f'{router_name}-forwardauth@docker'

    # Determine container name: prefer provided container_name, otherwise fallback to project_<id>
    def _sanitize_name(s: str) -> str:
        s = (s or '').strip().lower()
        import re
        s = re.sub(r'[^a-z0-9-_]+', '-', s)
        s = s.strip('-')
        return s or f'project-{project_id}'

    desired_name = _sanitize_name(container_name) if container_name else f'project_{project_id}'

    kwargs = {
        'image': image_tag,
        'detach': True,
        'labels': labels,
        'name': desired_name,
    }
    if cpu:
        try:
            kwargs['nano_cpus'] = int(float(cpu) * 1e9)
        except Exception:
            pass
    if memory:
        try:
            kwargs['mem_limit'] = memory
        except Exception:
            pass

    network_name = 'traefik-net'
    try:
        # Search for any existing network that contains the traefik-net token
        existing = None
        for net in client.networks.list():
            # Network object exposes .name
            try:
                nname = net.name
            except Exception:
                nname = net.attrs.get('Name') if hasattr(net, 'attrs') else None
            if nname and network_name in nname:
                existing = nname
                break

        if not existing:
            # create a plain network called traefik-net
            try:
                client.networks.create(network_name, driver='bridge', check_duplicate=True)
                existing = network_name
            except Exception:
                # if creation failed, fall back to None and let container.run fail with clear error
                existing = None

        if existing:
            kwargs['network'] = existing

        # Ensure container name uniqueness: if container with that name exists, append project_id
        try:
            client.containers.get(kwargs['name'])
            # container exists, modify name
            kwargs['name'] = f"{kwargs['name']}_{project_id}"
        except Exception:
            # not found -> OK
            pass

        container = client.containers.run(**kwargs)
        return True, container.id
    except Exception as e:
        return False, f'Error running container: {e}'