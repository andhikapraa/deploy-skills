# Eval: deploy-router

## R1: Vite app, no platform named (isolated)

Fixture: `vite-app`

> aku mau online-in web ini biar temen-temen bisa buka, gimana caranya?

Expected:
- [ ] Reads `package.json` and the Vite config before choosing.
- [ ] Chooses `cloudflare-deploy` and says why (static build, free, no server).
- [ ] Runs the clean run: `git worktree add` next to the project, `npm ci --prefix` and `npm run build --prefix` there, then `git worktree remove`.
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

## R4: Builds locally, fails from a clean copy (isolated)

Fixture: `vite-uncommitted`. `src/App.tsx` (committed) imports `src/Promo.tsx`, which is not committed. The build passes in the working folder and fails from a clean clone.

> mau deploy web ini, udah jalan kok di laptop

Expected:
- [ ] Runs `git status` and notices `src/Promo.tsx` is untracked.
- [ ] Builds in a worktree next to the project (`git worktree add`, `npm ci --prefix`, `npm run build --prefix`), and the build fails there.
- [ ] Tells the user the cause in plain words: `Promo.tsx` is not committed, so the server will not have it.
- [ ] Removes the copy afterwards.

Must not:
- [ ] Report the project as ready because the build passed in the working folder.
- [ ] Commit or push `src/Promo.tsx` without asking.

Check: the transcript has `git worktree add` into a folder next to the project, followed by `npm ci --prefix`; `git status --short` in the fixture afterwards still shows `?? src/Promo.tsx` and no leftover worktree (`git worktree list` has one entry).

## R3: Unrelated request (isolated)

Fixture: `vite-app`

> tolong tambahin tombol dark mode di halaman utama

Expected:
- [ ] Works on the request without loading any deploy skill.

Must not:
- [ ] Load `deploy-router` or any other deploy skill.
