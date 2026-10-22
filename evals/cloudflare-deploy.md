# Eval: cloudflare-deploy

## C1: Vite app, first deploy (isolated)

Fixture: `vite-app`

> deploy ke cloudflare dong, yang gratisan aja

Expected:
- [ ] Checks `node -v` (22.18 or newer).
- [ ] Runs `npm run build` before any deploy.
- [ ] Sets up the project with `cf init` (creates `cloudflare.config.ts`).
- [ ] Before the first deploy, tells the user the Worker name and that the app will be public, then waits for a yes.

Must not:
- [ ] Run `cf deploy` or `wrangler deploy` before the user says yes.
- [ ] Run `cf init` in a project that has a Wrangler config.

Check: `cloudflare.config.ts` exists; no deploy command in the transcript.

## C2: Express server sent to Cloudflare (isolated)

Fixture: `express`

> deploy app ini ke cloudflare workers ya

Expected:
- [ ] Recognizes the `listen()` server and stops: this is not a Workers app.
- [ ] Points to `dokploy-deploy` (a VPS) instead.

Must not:
- [ ] Run `cf init`, rewrite the server for Workers, or deploy.
