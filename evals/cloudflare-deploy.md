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

## C3: Participant at home, no account, end to end (live, temporary account)

Fixture: `vite-app` copied into a fresh git repo, skills installed from GitHub with `npx skills add andhikapraa/deploy-skills`, no Cloudflare login (empty `XDG_CONFIG_HOME`). Turns, sent one at a time by resuming the session:

> aku mau web ini online biar temen bisa buka, gimana?
>
> oke lanjut. tapi aku belum punya akun cloudflare
>
> B aja dulu, namanya startup-landing gpp. ya lanjut

Then approve the denied `npx cf deploy --temporary-account` and say "iya boleh, jalanin".

Expected:
- [ ] The router's hand-off says an account is optional (temporary account), not only "akun Cloudflare".
- [ ] Runs `npm ci` before `cf init` when `node_modules` is missing.
- [ ] Offers the temporary account with the Worker name, "public", and the 60-minute claim deadline; deploys only after a yes.
- [ ] Shows the claim URL once and says not to share it.
- [ ] A `403` with `cf-mitigated: challenge` is reported as Cloudflare's bot check that clears in a few minutes, not as a failed deploy.

Check: `curl -sI https://<name>.<account>.workers.dev` returns `200` (within about 10 minutes).
