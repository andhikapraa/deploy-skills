---
name: deploy-router
description: Decide how to deploy the current project for the first time and check that it is ready. Use when the user asks to deploy, launch, host, publish, or "online-kan" an app and has not yet chosen a platform, or asks whether Cloudflare or a VPS with Dokploy fits their project. Routes to cloudflare-deploy or dokploy-deploy.
---

# Deploy router

Pick the simplest platform that can run this project, confirm it is ready to ship, then hand off. Reply in the user's language (often Bahasa Indonesia) and explain each term the first time you use it, in one plain sentence. Many users are first-time deployers.

## 0. Update first

1. Run `npx -y skills@latest update -y`.
2. If it updated any skill, re-read this file before continuing.

## 1. Inspect the project

Read, do not change, the project:

- `package.json` scripts and dependencies, or the equivalent for other languages (`requirements.txt`, `composer.json`, `go.mod`);
- framework config files (`vite.config.*`, `next.config.*`, `astro.config.*`, `nuxt.config.*`, `svelte.config.*`);
- a `Dockerfile` or `docker-compose.yml`;
- a server entry point (`server.js`, `app.listen(`, `express()`, `fastify(`, `uvicorn`, `artisan`);
- database or queue usage (`pg`, `mysql2`, `prisma`, `drizzle`, `mongoose`, `redis`, `bullmq`);
- `.env*` files and `.gitignore`;
- whether the folder is a git repository with a GitHub remote (`git remote -v`).

Done when you can answer: what is built, what has to keep running, and what it needs to connect to.

## 2. Choose the route

| What the project is | Route |
|---|---|
| Static HTML, or a client-side app (React/Vue/Svelte with Vite, Lovable or Bolt exports) | `cloudflare-deploy` |
| Uses only a hosted backend (Supabase, Firebase, Appwrite Cloud) from the browser | `cloudflare-deploy` |
| Astro, Next.js, Nuxt, SvelteKit, React Router, TanStack Start with light server code | `cloudflare-deploy` |
| Small API that fits Workers (fetch handlers, no long-running process) | `cloudflare-deploy` |
| Express, Fastify, NestJS, Laravel, Django, FastAPI, Go server, or any `listen()` process | `dokploy-deploy` |
| Needs its own Postgres/MySQL/Redis, websockets, cron workers, or file uploads to local disk | `dokploy-deploy` |
| Has a Dockerfile or docker-compose that must run as-is | `dokploy-deploy` |
| Native Node APIs Workers lacks, or more than 128 MB memory per request | `dokploy-deploy` |

When both fit, choose Cloudflare: it is free and needs no server. Cloudflare free limits that matter: static requests are free and unlimited; Worker code gets 100,000 requests per day and 10 ms of CPU time per request.

If the route is `dokploy-deploy` and the user has no Dokploy server yet, `sumopod-dokploy-setup` comes first.

## 3. Readiness check

Check each item and fix only what the user approves:

1. The project builds locally (`npm run build` or the project's equivalent). A local build failure will also fail on the server.
2. `.env` and other secret files are listed in `.gitignore` and are not tracked (`git ls-files | grep -i env`). If a secret was committed, tell the user to rotate it; deleting the file does not remove it from history.
3. List the environment variables the app reads, and mark which ones are secret.
4. For a browser app: any variable with a public prefix (`VITE_`, `NEXT_PUBLIC_`, `PUBLIC_`) ends up in the JavaScript that every visitor downloads. A secret key there is leaked. Move it behind a server or use a key designed to be public (for example the Supabase anon key with row-level security).
5. For `dokploy-deploy`: the code is pushed to GitHub.

## 4. Hand off

Tell the user, in at most three lines: the chosen route, why, and what they need before starting (for example "akun Cloudflare" or "VPS SumoPod + Dokploy"). Then follow the chosen skill.

## Completion

Done when the route is chosen with a stated reason, the readiness items pass or the user has accepted the remaining gaps, and the next skill has started.
