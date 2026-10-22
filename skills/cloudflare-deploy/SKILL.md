---
name: cloudflare-deploy
description: Deploy a static site, single-page app, supported full-stack framework, or small API to Cloudflare Workers on the free plan with the cf CLI, or with Wrangler in projects that already have a Wrangler config, and redeploy it later. Use when the user wants to deploy to Cloudflare, Workers, Pages, or workers.dev, or when deploy-router chose Cloudflare.
license: MIT
compatibility: Needs Node.js 22.18+ and network access to Cloudflare. A Cloudflare account, or the temporary account the cf CLI can create.
---

# Deploy to Cloudflare Workers

Reply in the user's language and explain what each command does before running it. Deploying publishes the app on the public internet: before the first deploy, tell the user the Worker name and that the result will be public, and wait for a yes.

## 0. Update first

1. Run `npx -y skills@latest update -y`.
2. If it updated any skill, re-read this file before continuing; the steps below may have changed.

## 1. Choose the CLI

`cf` is Cloudflare's new CLI and is in beta, so its commands can change between releases. Prefer discovery over memory: when a command is not listed in this file, find it with `npx cf cli search "<describe the task>"` and read `npx cf <command> --help`. Keep search queries anonymous: describe the action, never names, emails, domains, or IDs.

Check in this order and take the first match:

| Project | Path |
|---|---|
| `cloudflare.config.ts` exists | `cf` (step 2 onward) |
| `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml` exists | [Wrangler branch](#wrangler-branch) |
| Next.js (`next` in dependencies) | [Next.js branch](#nextjs-branch) |
| SvelteKit (`@sveltejs/kit` in dependencies) | [Wrangler branch](#wrangler-branch); `cf` does not support SvelteKit yet |
| Astro (`astro` in dependencies) | [Wrangler branch](#wrangler-branch); `cf` writes a Wrangler config for Astro and then cannot build it |
| Vite (React, Vue, Svelte, Solid), plain HTML, or another detected framework | `cf` (step 2 onward) |
| A server that calls `listen()` (Express, Fastify, NestJS), or no frontend at all | Stop: this is not a Workers app. Use `dokploy-deploy` |

In a project with a Wrangler config, never run `cf init`, `cf build`, `cf dev`, or `cf deploy`: they write a second config that ignores the Wrangler file.

## 2. Preflight

1. `node -v` must be 22.18 or newer. If older, stop and tell the user to install the current LTS from nodejs.org. Bun is not supported.
2. The project builds locally with its own build script (`npm run build`). Without `node_modules`, run `npm ci` first. Fix failures here first; they are easier to read than deploy errors.
3. `cf build` and `cf deploy` run only the framework's build (for example `vite build`), not the `build` script, so extra steps are skipped. The Vite templates use `tsc -b && vite build`: under `cf deploy` a type error no longer stops the deploy. Always run `npm run build` before `cf deploy`, so the project's own checks still gate what goes live.

## 3. Set up the project

Skip when `cloudflare.config.ts` already exists.

1. **Plain HTML without a build step:** move the site files (`index.html`, CSS, images) into a `public/` folder first. Otherwise `cf` uploads the whole project folder, including `node_modules`, and the deploy fails on file size. Commit the move.
2. Run `npx -y cf@latest init .`. It detects the framework and prints the Worker name, framework, build command, and output directory. In a terminal it asks before changing files; when the agent runs it without a terminal it applies the changes directly, so show the user the detected settings and changed files afterwards.
3. For a Vite app it installs `cf` and `@cloudflare/vite-plugin` as devDependencies, creates `cloudflare.config.ts`, adds a `deploy` script, and adds `.env*`, `.dev.vars*`, and `.wrangler` to `.gitignore`.
4. For plain HTML it creates `wrangler.config.ts` but does not install Wrangler, so the build fails with "No Cloudflare dev-server is installed". Run `npm i -D wrangler@latest`.
5. Add the build output folder to `.gitignore`: `echo ".cloudflare/" >> .gitignore`.
6. Check `cloudflare.config.ts`: the `name` becomes part of the URL (lowercase letters, digits, and dashes). For a client-side router, `assets.notFoundHandling` should be `"single-page-application"`.

## 4. Use the latest cf

`cf init` pins `cf` in `package.json` and the lockfile. Before every deploy session, run `npm i -D cf@latest` so the project uses the newest release, then `npx cf --version`.

## 5. Sign in

Run `npx cf auth whoami`.

- **Signed in:** continue.
- **Not signed in, and the user has or wants a Cloudflare account:** the user runs the login, because it waits for them to approve in the browser. Ask them to run `npx cf auth login` in their own terminal. In Claude Code they can type `! npx cf auth login` in the chat. It prints a link and a one-time code and opens the browser, where they sign in or create a free account and approve. Then run `npx cf auth whoami` again. `cf` keeps its own login, separate from Wrangler.
- **Not signed in, and the user does not want an account yet:** offer a temporary account, naming the Worker and saying it will be public: "Aku bisa online-kan ini sebagai `<worker-name>` di URL publik `*.workers.dev`, selama 60 menit tanpa login. Supaya nggak hilang, buka link claim sebelum waktunya habis. Mau?" Only after a yes, deploy with `npx cf deploy --temporary-account`. It prints a claim URL; tell the user to open it and sign in within 60 minutes, or Cloudflare deletes the account and the app. Treat the claim URL like a password: show it only to this user. It does not work when the user is already signed in.

Never ask the user to paste a Cloudflare API token into the chat.

## 6. Environment variables and secrets

- Build-time public variables (`VITE_*`, `NEXT_PUBLIC_*`, `PUBLIC_*`) are read from `.env` at build time and become visible to every visitor. Never put a secret there.
- A pure static or single-page app has no server code, so it has no server secrets. Skip the next point.
- Secrets read by server code: declare each one in `cloudflare.config.ts` under `worker.env` as `NAME: bindings.secret()` (import `bindings` from `cf/config`). Ask the user to create `.env.secrets` with `NAME=value` lines in their editor, so the values never enter the chat. `cf init` already gitignores `.env*`; confirm with `git check-ignore .env.secrets`. Then deploy with `npx cf deploy --secrets-file .env.secrets`. Secrets persist across later deploys, so pass the file again only when a value changes.
- Local development secrets go in `.dev.vars` or `.env`, also gitignored.

## 7. Deploy

1. Run `npm run build` and stop if it fails (see preflight step 3).
2. Validate without uploading: `npx cf deploy --dry-run`.
3. Deploy: `npx cf deploy` (or `--temporary-account`, see step 5).
4. It prints the URL, usually `https://<name>.<account-subdomain>.workers.dev`. HTTPS works immediately. If the account has no `workers.dev` subdomain yet, follow the command's prompt or its error message.

## 8. Verify

1. `curl -sI <url>` returns `200`.
2. For a single-page app, `curl -sI <url>/some/route` also returns `200`.
3. Ask the user to open the URL and click through the main flow. Failing API calls usually mean a missing environment variable or secret.

## Later

- Redeploy after changes: repeat step 7.
- Logs, rollback, custom domains, and automatic deploys from GitHub: find the current command with `npx cf cli search`, or use the Cloudflare dashboard under Workers & Pages. A custom domain needs a domain whose DNS is on Cloudflare.

## Wrangler branch

For projects with a Wrangler config, and for SvelteKit and Astro:

1. Use the project's Wrangler, updated: `npm i -D wrangler@latest`, then `npx wrangler --version`.
2. No Wrangler config yet (SvelteKit, Astro): run `npx wrangler setup`. It detects the framework, installs the Cloudflare adapter, writes `wrangler.jsonc`, and adds a `deploy` script; show the user what changed. For SvelteKit, the new `build` script starts with `wrangler types --check`: run `npx wrangler types` now, and again whenever `wrangler.jsonc` changes (including the Worker name).
3. Sign in: `npx wrangler whoami`. If not signed in, the user runs `npx wrangler login` themselves (browser approval; add `--device` on a remote machine or in a container). Without an account, after the same 60-minute explanation and a yes, use `npx wrangler deploy --temporary`.
4. Static or single-page apps need `assets.directory` (the build output) and, for client-side routers, `assets.not_found_handling: "single-page-application"` in the Wrangler config.
5. Build with the project's script and stop if it fails. `wrangler deploy` uploads whatever is already in the output folder, so a failed build would ship the previous build without any error. Then `npx wrangler deploy --dry-run`, then `npx wrangler deploy`.
6. Secrets: `npx wrangler secret put <NAME>`, run by the user so they type the value into the prompt.

## Next.js branch

Cloudflare's recommended path for Next.js is vinext, a Vite reimplementation of Next.js that is in beta. Keep an existing OpenNext setup (`open-next.config.ts`) if the project already has one.

1. `npx -y vinext@latest check` and show the user the compatibility report. If it flags features the app depends on, stop and suggest `dokploy-deploy`, which runs real Next.js.
2. Set up. `vinext init` refuses to guess cache options, so pass them. Use `npx -y vinext@latest init --platform=cloudflare --cdn-cache=data-cache --data-cache=kv --image-optimization=none`. The app router template uses ISR, and `vinext-cloudflare deploy` stops when no cache is configured, so do not choose `--data-cache=none` unless `vinext check` reports no ISR. The KV namespace is created on the first deploy, on the free plan. It writes `cloudflare.config.ts` and `vite.config.ts` and adds `*:vinext` scripts; `next dev` keeps working.
3. Sign in as in step 5.
4. Build with `npm run build:vinext`, then `npx cf deploy --dry-run`, then deploy with `npm run deploy:vinext`.

## Common failures

| Symptom | Cause and fix |
|---|---|
| 404 on refresh of `/about` | Single-page-app handling is not set |
| Blank page, assets 404 | Wrong output directory, or the app's base path is not `/` |
| Type errors appear only locally | `cf build` skipped `tsc -b`; see preflight step 3 |
| Deploy fails on a 100+ MiB file in `node_modules` | A plain HTML site was set up from the project root; move the site into `public/` (step 3.1) |
| "No Cloudflare dev-server is installed" | `npm i -D wrangler@latest` (step 3.4) |
| "cf does not support SvelteKit projects yet" | Use the Wrangler branch |
| "Build Output Specification: no root config found" | `cf` cannot build this framework (seen with Astro); undo its changes and use the Wrangler branch |
| "Types at worker-configuration.d.ts are out of date" (SvelteKit) | `npx wrangler types`, then rebuild |
| vinext: "no cache adapter is configured" | Re-run `vinext init` with `--cdn-cache=data-cache --data-cache=kv` |
| "cf could not detect a project" | No frontend framework was found; usually a Node server, so use `dokploy-deploy` |
| `Exceeded CPU time limit` | Server code needs more than 10 ms CPU per request on the free plan. Move heavy work elsewhere or use `dokploy-deploy` |
| A Node module is missing at runtime | The library needs Node APIs Workers lacks; use `dokploy-deploy` |
| Works locally, API calls fail live | The variable was missing at build time, or the secret was not set |
| Temporary account creation is refused | Cloudflare rate-limits temporary accounts; wait, or sign in with a real account |

## Completion

Done when the URL returns 200, the user has opened it, no secret is committed or exposed to browser code, any temporary account has been claimed or the user knows its deadline, and the user knows how to redeploy.
