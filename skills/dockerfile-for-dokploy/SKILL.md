---
name: dockerfile-for-dokploy
description: Write or fix the Dockerfile, .dockerignore, and (only when needed) compose.yaml for a project that will deploy to Dokploy on a small VPS. Use when dokploy-deploy needs a Dockerfile, when the user asks to Dockerize an app for Dokploy, or when a Dokploy build or container fails because of its Dockerfile or compose file.
license: MIT
compatibility: Writes files in the project only. Docker on the user's machine is optional, for a local build check.
---

# Dockerfile for Dokploy

Give the project a small, non-root image that Dokploy builds on the VPS itself, usually a 2 GB server that also runs Dokploy. Reply in the user's language. This skill only writes files in the project; `dokploy-deploy` does the deploying.

For general Dockerfile and Compose practice, Docker's own skills apply when installed (`docker-build-strategies`, `docker-compose-patterns`). Where they disagree with this file about Dokploy (published ports, volumes, `.env`, image size on a small server), follow this file.

## 0. Update first

1. Run `npx -y skills@latest update -y`.
2. If it updated any skill, re-read this file before continuing.

## 1. Read the project

Find: the language and framework, the lockfile (`package-lock.json`, `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, `requirements.txt`), the build script, the start command (`scripts.start`, `main`, or the entry file it runs), the port the app listens on, and whether it reads `PORT`.

If the project already has a `Dockerfile`, keep it and check it against the rules in step 3 instead of replacing it.

Done when you can name the template and the exact start command.

## 2. Copy a template

Templates live in `templates/` next to this file. All were built and run on a 2 GB SumoPod VPS with Docker 28.5 (image sizes measured there):

| Project | Template | Port | Image |
|---|---|---|---|
| Express, Fastify, NestJS, Hono on Node (npm) | `node-server.Dockerfile` | 3000 | 175 MB |
| Bun server (Hono, Elysia, `Bun.serve`) | `bun.Dockerfile` | 3000 | 98 MB |
| Vite / React / Vue / Svelte SPA | `vite-static.Dockerfile` + `nginx.conf` | 8080 | 60 MB |
| Next.js | `nextjs.Dockerfile`, and add `output: "standalone"` to `next.config.*` | 3000 | 268 MB |
| FastAPI, Flask, Django with `requirements.txt` | `python.Dockerfile` | 8000 | 137 MB |

For comparison, Dokploy's `railpack` builder made a 416 MB image for a small Express app.

1. Read the template and write its content to `Dockerfile` at the build path (usually the repository root), and `templates/dockerignore` to `.dockerignore` next to it. For the SPA, also write `nginx.conf`. Use the file read and write tools rather than `cp`: agents such as Claude Code ask for approval before a shell command touches the skill folder.
2. Set the start `CMD` to the project's real entry: the file `npm start` runs (`["node", "dist/index.js"]`), not `npm start` itself, so the process gets stop signals.
3. Set `EXPOSE` to the port the app listens on. The app must listen on `0.0.0.0`, not `localhost`.
4. For pnpm or yarn, replace the lockfile name and install command (`corepack enable pnpm && pnpm install --frozen-lockfile`). Without any lockfile, run the project's install once locally to create one and commit it.
5. Browser apps: declare every public build-time variable (`VITE_*`, `NEXT_PUBLIC_*`) as an `ARG` before the build step, as the templates show for one. Dokploy passes them as build args; they end up in public JavaScript, so never put a secret there.

Done when the `Dockerfile`, `.dockerignore`, and any `nginx.conf` exist and the `CMD`, `EXPOSE`, lockfile, and `ARG` lines match this project.

## 3. Rules every Dockerfile here keeps

- `.dockerignore` excludes `.env`. Dokploy writes the app's environment to `.env` in the build folder before it builds, so without this line every secret is copied into the image.
- The runtime stage runs as a non-root user (`node`, `bun`, the nginx-unprivileged user, or a created `app` user).
- Base images are pinned to a major version (`node:24-alpine`), never `latest`.
- Runtime secrets come from Dokploy environment variables at run time. Never put a secret in `ARG`, `ENV`, or a copied file.
- Node and Bun on Alpine run under `tini` (as the templates do). Without it the app ignores stop signals and every redeploy waits 10 seconds for a kill.
- No healthcheck that needs `curl` or `wget` in an image without them.
- Distroless or shell-less images cannot run a migrate command through a shell; note the migrate entry point for `dokploy-deploy` step 5.

## 4. Check the build

If Docker runs on the user's machine, build and run it once (the agent may need the user's approval for `docker`):

```bash
docker build -t app-check .
docker run --rm -p 3000:3000 --env-file .env app-check
```

Then open `http://localhost:3000` (use the port from `EXPOSE`). Without Docker locally, the first Dokploy deploy is the check: read its build log with `dokploy deployment readLogs` if it fails.

On a 2 GB VPS, a Next.js build peaked at about 1.3 GB RAM and 1 GB swap in testing. Larger Next.js apps may need the 4 GB plan.

Done when the image builds and the app answers on its port.

## 5. Compose (only for several services)

Use a Dokploy **Application** with the Dockerfile and a Dokploy-managed database for one service plus a database. Use **Compose** only when the project has several of its own services (for example `web` plus a background `worker`) or ships a `compose.yaml` that must run as-is.

Start from `templates/compose.yaml` (web + worker + Postgres, tested on Dokploy with Isolated Deployments and an `sslip.io` HTTPS domain) and keep:

- No `ports:` on web services. Use `expose:` and add the domain in Dokploy for that service and its container port; Traefik routes to it. Published ports bypass HTTPS and open the service to the internet.
- Turn on **Isolated Deployments** for the compose service in Dokploy, so its service names do not clash with other apps and no `dokploy-network` entry is needed. Without it, every service that a domain points to must join the external `dokploy-network`.
- Named volumes for data (`db-data:/var/lib/postgresql`); Dokploy volume backups only cover named volumes. For files you edit by hand, use `../files/<name>:/path`. Never an absolute host path.
- Secrets as `${VAR:?set in Dokploy}`. Dokploy writes its environment to `.env` next to the compose file for substitution; it does not inject it into containers unless the file uses `${VAR}` or `env_file: .env`.
- `depends_on` with `condition: service_healthy`, and a `healthcheck` on the database.
- Every file a service runs (for example `worker.js`) must be in the image; `.dockerignore` does not exclude it.

Done when `docker compose config --quiet` passes (where Docker is available) and every web service has an `expose:` port and no `ports:`.

## Completion

Done when the Dockerfile and `.dockerignore` (and `compose.yaml` if used) are committed and pushed, `.env` is excluded, the runtime user is not root, and you have told `dokploy-deploy` the build type (`dockerfile`, or Compose), the port, and any build args.
