---
name: deploy-router
description: Decide how to deploy the current project for the first time and check that it is ready. Use when the user asks to deploy, launch, host, publish, or "online-kan" an app and has not yet chosen a platform, or asks whether Cloudflare or a VPS with Dokploy fits their project. Routes to cloudflare-deploy or dokploy-deploy.
license: MIT
compatibility: Needs git and Node.js 22.18+ (for npx). Works in any Agent Skills client, such as Claude Code, Antigravity, Codex, or Cursor.
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
- a `Dockerfile`, `compose.yaml`, or `docker-compose.yml`;
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
| Astro, SvelteKit, Nuxt, React Router, TanStack Start with light server code | `cloudflare-deploy` |
| Next.js that passes `npx vinext check` | `cloudflare-deploy`; otherwise `dokploy-deploy` |
| Small API that fits Workers (fetch handlers, no long-running process) | `cloudflare-deploy` |
| Express, Fastify, NestJS, Laravel, Django, FastAPI, Go server, or any `listen()` process | `dokploy-deploy` |
| Needs its own Postgres/MySQL/Redis, websockets, cron workers, or file uploads to local disk | `dokploy-deploy` |
| Has a Dockerfile or docker-compose that must run as-is | `dokploy-deploy` |
| Native Node APIs Workers lacks, or more than 128 MB memory per request | `dokploy-deploy` |

When both fit, choose Cloudflare: it is free and needs no server. Cloudflare free limits that matter: static requests are free and unlimited; Worker code gets 100,000 requests per day and 10 ms of CPU time per request.

If the route is `dokploy-deploy`, check for a server before choosing the next skill: run `npx -y dokploy-kit@2 project all`. JSON output (even `[]`) means a server and login exist: continue with `dokploy-deploy`. "Not logged in" means ask the user whether they already have a Dokploy server; only if they do not, `sumopod-dokploy-setup` comes first. If the project has no `Dockerfile`, `dokploy-deploy` adds one with `dockerfile-for-dokploy`.

## 3. Readiness check

Check each item and fix only what the user approves:

1. **Clean run.** Build the project the way a server will: from the committed code, in an empty folder, with a fresh install. The user's working folder has files, installs, and settings a server never gets, so a build there can pass and still fail on deploy.
   1. Run `git status --short --branch`. Uncommitted or untracked files the app needs are not on the server; list them. `ahead` means commits are not pushed yet; for `dokploy-deploy` they must be.
   2. Make the empty copy next to the project, one plain command at a time, so agent permission prompts stay simple (no `cd`, `mktemp`, `$(...)`, or `&&` chains): `git worktree add --detach ../<project>-deploy-check HEAD`.
   3. Install and build in the copy with the project's own commands, pointed at it: `npm ci --prefix ../<project>-deploy-check`, then `npm run build --prefix ../<project>-deploy-check` (or the stack's equivalent, such as `pip install -r requirements.txt` or `composer install --working-dir`).
   4. Tell the user the result in one line per finding, naming the cause: a file that is not committed or pushed, a lockfile that does not match `package.json` (`npm ci` fails), or a build error. A failure here will also fail on the server.
   5. Remove the copy: `git worktree remove --force ../<project>-deploy-check`. The user's working folder stays untouched.
2. `.env` and other secret files are listed in `.gitignore` and are not tracked (`git ls-files | grep -i env`). If a secret was committed, tell the user to rotate it; deleting the file does not remove it from history.
3. List the environment variables the app reads, and mark which ones are secret. The clean copy has none of them; the user sets each one on the hosting platform.
4. For a browser app: any variable with a public prefix (`VITE_`, `NEXT_PUBLIC_`, `PUBLIC_`) ends up in the JavaScript that every visitor downloads. A secret key there is leaked. Move it behind a server or use a key designed to be public (for example the Supabase anon key with row-level security).

## 4. Hand off

Tell the user, in at most three lines: the chosen route, why, and what they need before starting (for example "akun Cloudflare gratis, atau tanpa akun dulu pakai akun sementara 60 menit" or "VPS SumoPod + Dokploy"). A user without a Cloudflare account can still continue: `cloudflare-deploy` offers the temporary account. Then follow the chosen skill.

## Completion

Done when the route is chosen with a stated reason, the clean run has built in an empty copy (or its failures are reported with their cause), the copy is removed, the readiness items pass or the user has accepted the remaining gaps, and the next skill has started.
