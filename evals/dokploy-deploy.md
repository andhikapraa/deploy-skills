# Eval: dokploy-deploy

Both prompts are *live*: they need a Dokploy server and a saved `dokploy login`. Delete the project they create afterwards.

## K1: Express + Postgres, public repo, no Dockerfile (live)

Fixture: `express`, pushed to a public GitHub repository without Docker files.

> deploy app ini ke dokploy ya, repo-nya publik di <repo-url>. GREETING isinya "Halo dari eval". kasih URL-nya kalau udah jalan

Expected:
- [ ] Adds a Dockerfile and `.dockerignore` with `dockerfile-for-dokploy`, commits, and pushes before creating the app.
- [ ] Build type `dockerfile`; custom git source with the HTTPS URL.
- [ ] Creates Postgres with a generated password and sets `DATABASE_URL` with the internal host.
- [ ] Waits with `dokploy deployment wait`, not a shell loop.
- [ ] Creates an `sslip.io` domain with HTTPS on port 3000 and checks it responds.
- [ ] Says that a push does not redeploy a public custom-git app on its own.

Must not:
- [ ] Show the database password in the reply.
- [ ] Wait with `while`, `until`, or `sleep` loops.

Check: `https://<host>/` returns the greeting, `https://<host>/db` returns the Postgres version, the image runs as non-root, and `/app/.env` does not exist in the image.

## K2: Missing variable value (live)

Fixture: same as K1, Docker files already committed.

> deploy app ini ke dokploy, repo publik <repo-url>

Expected:
- [ ] Reads `server.js` and finds `GREETING`.
- [ ] Asks the user for the value of `GREETING` before deploying.

Must not:
- [ ] Invent a value for `GREETING`.

## K3: Participant at home, vague prompt (live)

Fixture: `andhikapraa/demo-express-postgres` at tag `start`, pushed to a new public temp repo. Project name starts with `sim-`.

> gimana caranya biar app ini online? kata mentor pake dokploy yg udah dipasang kemarin. repo github nya github.com/<owner>/<repo>. project dokploy namain sim-catatan-N

Expected:
- [ ] Checks public/private itself (`curl` to the GitHub page), instead of asking the user.
- [ ] Asks before `git push` and asks for `GREETING`, ending the turn.
- [ ] After the yes: Postgres, deploy, `sslip.io` HTTPS domain, and checks `/` and `/db` itself (with `curl -sk` while the certificate is pending).
- [ ] One command per call, ids written literally (no `A=...;` prefixes or `&&` chains that trigger approval prompts).

Check: `https://<host>/` and `/db` return `200`.
