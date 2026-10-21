---
name: cloudflare-deploy
description: Deploy a static site, single-page app, supported full-stack framework, or small API to Cloudflare Workers on the free plan using Wrangler, and redeploy it later. Use when the user wants to deploy to Cloudflare, Workers, Pages, or workers.dev, or when deploy-router chose Cloudflare.
---

# Deploy to Cloudflare Workers

Cloudflare now recommends Workers with static assets for new projects; Pages still works but gets new features later. Use Workers unless the project already deploys to Pages. Reply in the user's language and explain what each command does before running it.

Deploying publishes the app on the public internet. Before the first `wrangler deploy`, tell the user the project name and that the result will be public, and wait for a yes.

## 1. Preflight

1. `node -v` must be 22 or newer. If it is older, stop and tell the user to install the current LTS from nodejs.org.
2. The project builds locally. Find the output directory: `dist` for Vite and Astro static, `build` for Create React App, `out` for a Next.js static export.
3. Prefer a project-local Wrangler so the version is pinned: if `wrangler` is not in `devDependencies`, ask, then run `npm install -D wrangler`. Run every command below as `npx wrangler ...`.

## 2. Log in

Run `npx wrangler whoami`. If not logged in, run `npx wrangler login`; it opens a browser where the user signs in or creates a free account and approves access. Never ask the user to paste a Cloudflare API token into the chat.

## 3. Configure

If `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml` already exists, read it and keep it.

Otherwise, choose one branch:

**Static site or single-page app** (only files to serve, no server code). Write `wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "<project-name>",
  "compatibility_date": "<today, YYYY-MM-DD>",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- `name`: lowercase letters, digits, and dashes. It becomes part of the URL.
- `directory`: the build output from preflight.
- Use `"single-page-application"` for client-side routers (React Router, Vue Router) so `/about` serves `index.html` instead of 404. For a plain multi-page static site use `"404-page"`.

**Framework with server rendering** (Next.js, Astro with SSR, Nuxt, SvelteKit, React Router, TanStack Start, Solid Start). Run `npx wrangler setup`. It detects the framework, shows what it will change, installs the Cloudflare adapter, writes `wrangler.jsonc`, and adds `deploy` and `preview` scripts. Show the user its summary before confirming.

## 4. Environment variables and secrets

- Build-time public variables (`VITE_*`, `NEXT_PUBLIC_*`, `PUBLIC_*`) are read from `.env` at build time and become visible to every visitor. Never put a secret there.
- Secrets used by server code: `npx wrangler secret put <NAME>`. The user types the value into the prompt; do not echo it or write it into any file.
- Non-secret server variables go under `"vars"` in `wrangler.jsonc`.
- For local development of server code, secrets go in `.dev.vars`, which must be in `.gitignore`.

## 5. Deploy

1. Build: `npm run build`, skipped when the `deploy` script from `wrangler setup` already builds.
2. Deploy: `npx wrangler deploy`. On the first deploy of an account, Wrangler asks to register a `workers.dev` subdomain; the user picks a name.
3. Wrangler prints the URL, usually `https://<name>.<subdomain>.workers.dev`. HTTPS works immediately.

## 6. Verify

1. `curl -sI <url>` returns `200`.
2. For a single-page app, also check a deep link such as `<url>/some/route` returns `200`.
3. Ask the user to open the URL and click through the main flow. Look for failing API calls caused by missing environment variables.

## Redeploy, rollback, logs

- Redeploy after changes: build, then `npx wrangler deploy` again.
- Automatic deploy on every push is available by connecting the GitHub repository in the Cloudflare dashboard under Workers & Pages, then the Worker's Settings, then Builds. This is optional.
- Roll back: `npx wrangler rollback`.
- Live logs from server code: `npx wrangler tail`.
- Custom domain: requires a domain whose DNS is on Cloudflare; add it in the dashboard under the Worker's Settings, then Domains & Routes.

## Common failures

| Symptom | Cause and fix |
|---|---|
| 404 on refresh of `/about` | Missing `"not_found_handling": "single-page-application"` |
| Blank page, assets 404 | Wrong `assets.directory`, or the app's base path is not `/` |
| `Exceeded CPU time limit` | Server code needs more than 10 ms CPU per request on the free plan. Move heavy work elsewhere or use `dokploy-deploy` |
| A Node module is not found at runtime | Add `"compatibility_flags": ["nodejs_compat"]`; if it still fails, the library needs real Node, so use `dokploy-deploy` |
| Works locally, API calls fail live | The environment variable was not set for the build or as a secret |

## Completion

Done when the URL returns 200, the user has opened it, no secret is committed or exposed in browser code, and the user knows the redeploy command.
