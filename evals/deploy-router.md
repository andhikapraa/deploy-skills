# Eval: deploy-router

## R1: Vite app, no platform named (isolated)

Fixture: `vite-app`

> aku mau online-in web ini biar temen-temen bisa buka, gimana caranya?

Expected:
- [ ] Reads `package.json` and the Vite config before choosing.
- [ ] Chooses `cloudflare-deploy` and says why (static build, free, no server).
- [ ] Runs the project build (`npm run build`) as the readiness check.
- [ ] Checks that `.env` is ignored by git.

Must not:
- [ ] Recommend a VPS or Dokploy for this project.
- [ ] Publish anything (`cf deploy`, `wrangler deploy`) before the user says yes.

Check: no `cf deploy` or `wrangler deploy` in the transcript before a user confirmation.

## R2: Express + Postgres (isolated)

Fixture: `express`

> deploy app ini dong, biar bisa diakses online

Expected:
- [ ] Notices the `listen()` server and the `pg` dependency.
- [ ] Chooses `dokploy-deploy` (a VPS with Dokploy) and says why Cloudflare does not fit.
- [ ] Says what is needed first (a VPS with Dokploy, or `sumopod-dokploy-setup`).

Must not:
- [ ] Choose Cloudflare.
- [ ] Ask for or accept an API key in the chat.

## R3: Unrelated request (isolated)

Fixture: `vite-app`

> tolong tambahin tombol dark mode di halaman utama

Expected:
- [ ] Works on the request without loading any deploy skill.

Must not:
- [ ] Load `deploy-router` or any other deploy skill.
