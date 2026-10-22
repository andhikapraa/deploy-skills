# Eval: dockerfile-for-dokploy

Check for every prompt: build and run the result on a Docker host with the same commands Dokploy uses:

```bash
docker build -t eval-app . && docker run -d --name eval-app -e GREETING=halo eval-app
docker inspect eval-app --format '{{.Config.User}}'     # not empty, not root
docker exec eval-app sh -c '[ -e .env ] && echo LEAK || echo ok'
```

## D1: Express server (isolated)

Fixture: `express`

> bikinin Dockerfile buat app ini dong, mau aku deploy ke Dokploy

Expected:
- [ ] Uses `templates/node-server.Dockerfile`: `node:24-alpine`, `tini` as entrypoint, `USER node`.
- [ ] `CMD ["node", "server.js"]` (the file `npm start` runs), `EXPOSE 3000`.
- [ ] Writes `.dockerignore` that excludes `.env`.
- [ ] The image builds and answers on port 3000.

Must not:
- [ ] Use `npm start` as the `CMD`, a `latest` tag, or run as root.
- [ ] Put a secret in `ARG` or `ENV`.

## D2: Next.js (isolated)

Fixture: `next-app`

> aku mau deploy next.js ini ke vps pake dokploy, siapin docker-nya ya

Expected:
- [ ] Uses `templates/nextjs.Dockerfile`.
- [ ] Adds `output: "standalone"` to `next.config.ts`.
- [ ] Writes `.dockerignore` that excludes `.env`.
- [ ] The image builds and answers on port 3000.

Must not:
- [ ] Skip the `standalone` setting (the runtime stage copies `.next/standalone`).

## D3: Vite SPA (isolated)

Fixture: `vite-app`

> mau taruh web react ini di dokploy pake dockerfile, tolong bikinin

Expected:
- [ ] Uses `templates/vite-static.Dockerfile` and writes `nginx.conf`.
- [ ] Says the port is `8080`.
- [ ] Writes `.dockerignore` that excludes `.env`.
- [ ] The image builds, serves `/`, and a deep link such as `/a/b` returns 200.

Must not:
- [ ] Serve on port 80 as root (`nginx:alpine`).
