---
name: dokploy-deploy
description: Deploy a GitHub repository to an existing Dokploy server as an application, optionally with a Postgres database and a domain, then redeploy and read logs. Use when the user wants to deploy a backend, full-stack app, Docker app, or database-backed app to Dokploy or their VPS, or when deploy-router chose Dokploy.
license: MIT
compatibility: Needs Node.js 22.18+, a GitHub repository, and a Dokploy server with a saved dokploy-kit login.
---

# Deploy to Dokploy

Reply in the user's language and explain each Dokploy concept once: a **project** groups related services, an **environment** (such as `production`) lives inside a project, and an **application** is one running service built from a repository.

## 0. Update first

1. Run `npx -y skills@latest update -y`.
2. If it updated any skill, re-read this file before continuing.

Requires a working Dokploy server and a saved login. Check with `npx -y dokploy-kit@2 project all`. If it says "Not logged in": with no server yet, use `sumopod-dokploy-setup`; with a server, ask the user to run `npx -y dokploy-kit@2 login --url <panel-url>` in a separate terminal window (the hidden key prompt needs a real terminal), then check again. Never ask for the key in the chat.

## CLI

Use `dokploy-kit` major version 2 from npm, so a stale global install never answers and a future breaking release is not picked up unseen:

```bash
npx -y dokploy-kit@2 <domain> <action> --flag value
```

Below, `dokploy ...` is short for `npx -y dokploy-kit@2 ...`. Write the full command every time; do not store it in a shell variable such as `D="npx ..."`, because agent sandboxes ask for approval on commands they cannot check.

The CLI's built-in schema can lag behind the server: check the server version with `dokploy settings getDokployVersion`. When an action fails with a validation error the CLI did not predict, trust the server's error message over `--help`.

Commands look like `dokploy <domain> <action> --flag value`. Dokploy's API changes between versions, so run `dokploy <domain> <action> --help` before every action you have not run in this session and use the flags it shows. If `--help` disagrees with this file, follow `--help`.

Some actions mark nullable fields as required (for example `saveBuildType` requires `--dockerfile`, `--dockerContextPath`, `--dockerBuildStage`, `--herokuVersion`, `--railpackVersion`). Pass `null` for the ones that do not apply, such as `--dockerfile null`. Booleans take `--flag=true` or `--flag=false`.

Exception: for the `railpack` build type, `--railpackVersion` must be a real version. `null` makes the build download railpack `vnull` and fail in seconds. Use the version the server defaults to: create the application first, then read `railpackVersion` from `dokploy application one --applicationId <id>` and pass that value.

Actions named `delete`, `remove`, `stop`, or `kill` take effect immediately. Ask the user first, naming the exact resource.

## 1. Source

The repository must be on GitHub. Choose the branch:

- **Public repository:** use the custom git provider with the HTTPS clone URL. No GitHub connection is needed.
- **Private repository:** the user connects GitHub once in the Dokploy panel: Settings → Git → GitHub → Create GitHub App, then Install it on GitHub. Tell them to choose **Only select repositories** and pick just the repository to deploy; "All repositories" lets the Dokploy server clone every repo they own. Then find the provider with `dokploy github githubProviders` (keep its `githubId`) and confirm with `dokploy github testConnection --githubId <id>`, which reports how many repositories it can see. After that, use the GitHub provider action. Pushes then trigger automatic deploys.

## 2. Create the application

1. `dokploy project all`. Reuse a project with the right name, or `dokploy project create --name <name>`.
2. Find the environment: check the project from `project one` or `environment byProjectId`. Recent Dokploy versions create `production` automatically; create one only if none exists.
3. `dokploy application create --environmentId <id> --name <name>` once, and keep the `applicationId` from its output. Each call creates another application, so if the output was cut off, find the id with `dokploy project one --projectId <id>` instead of creating again.
4. Attach the source:
   - public: `dokploy application saveGitProvider --help`, then set `--customGitUrl` to the HTTPS clone URL, `--customGitBranch` (usually `main`), `--customGitBuildPath /`, and `--watchPaths null`;
   - private: `dokploy application saveGithubProvider --help`, then set owner, repository, branch, `--buildPath /`, `--triggerType push`, and the `githubId` of the connected GitHub App (from `dokploy github githubProviders`).

## 3. Build type

Prefer a Dockerfile: the image is smaller and the project controls how it builds. Check `dokploy application saveBuildType --help`. Choose:

| Project | Build type |
|---|---|
| Has a `Dockerfile` | `dockerfile` with `--dockerfile Dockerfile --dockerContextPath .` (paths relative to the build path) and `null` for the rest. Read the Dockerfile first: its `EXPOSE`, required env vars, and any migrate step decide steps 4 and 5. Check that `.dockerignore` excludes `.env` |
| No `Dockerfile` yet (Node, Bun, Next.js, Vite SPA, Python) | Use `dockerfile-for-dokploy` to add one, commit and push it, then use the row above. This is the default: ask the user before the push (it changes their repository), and fall back to `railpack` only if they decline |
| Language with no template there (PHP, Go, Ruby), or the user declines a Dockerfile | `railpack` (the successor to Nixpacks) with the server's default `--railpackVersion` (see above), never `null`; or `nixpacks` if railpack is unavailable |
| Several services of its own (`web` plus `worker`) or a `compose.yaml` that must run as-is | Compose, below, instead of an application |

Note the port the app listens on: the Dockerfile's `EXPOSE` (`3000` for the Node, Bun, and Next.js templates, `8080` for the Vite template, `8000` for Python). The app should listen on `0.0.0.0` and read the port from `PORT` when it can.

Public build-time variables (`VITE_*`, `NEXT_PUBLIC_*`) go in `--buildArgs` in step 4, one `KEY=value` per line, and the Dockerfile must declare each with `ARG`.

### Compose

Follow `dockerfile-for-dokploy` step 5 for the file itself. Then, in place of steps 2 to 4 and 6:

1. `dokploy compose create --environmentId <id> --name <name> --composeType docker-compose`; keep `composeId` and `appName`.
2. `dokploy compose update --help`, then set the source (public: `--sourceType git --customGitUrl <https url> --customGitBranch main --composePath ./compose.yaml`; private: the GitHub provider fields from step 1) and `--isolatedDeployment=true`.
3. `dokploy compose saveEnvironment --composeId <id> --env` with one `KEY=value` per line (ask the user for each value; generate only passwords). The compose file must reference them as `${KEY}`.
4. `dokploy compose deploy --composeId <id>`, then `dokploy deployment wait --composeId <id>`.
5. Domain: `dokploy domain create --composeId <id> --serviceName <web service> --domainType compose --host <host> --path / --port <container port> --https=true --certificateType letsencrypt` (get a host from `generateDomain --appName <appName>` as in step 7). Then deploy once more and wait with `--new`: compose domains apply on the next deploy.

Compose databases are not managed by Dokploy: their data lives in the compose file's named volume.

## 4. Environment variables

`dokploy application saveEnvironment --help`, then send `--env` with one `KEY=value` per line, `--buildArgs` with the public build-time variables from step 3 (or `null`), `--buildSecrets null`, and `--createEnvFile=true`. Ask the user for the value of every variable the app needs, secret or not; do not invent values, even for something that looks harmless such as a greeting. Secret values go directly into the command, never into a file in the repository. Generate only values that are meant to be random, such as a database password or an auth secret, and say that you did. Remind the user that changing variables requires a redeploy.

## 5. Database (only if the app needs one)

The app needs one when it reads `DATABASE_URL` or uses a database client (`pg`, `prisma`, `drizzle`, `mysql2`, `mongoose`). Then create it without waiting to be asked, and tell the user you did.

1. `dokploy postgres create --help`, then create it in the same environment with a database name, user, and a generated strong password. Generate it with `openssl rand -hex 24` as its own command and pass the value; agent sandboxes ask for approval on `$(...)` inside a command. Never show the password in the chat.
2. `dokploy postgres deploy --postgresId <id>`.
3. Read the internal connection details from `dokploy postgres one --postgresId <id>`. Apps in the same Dokploy server connect through the internal host name, not the public IP.
4. Save `DATABASE_URL=postgresql://<user>:<password>@<internal-host>:5432/<db>` in the application's environment.
5. Run migrations the way the project expects. Dokploy has no pre-deploy hook, so pick one:
   - The start command runs them (for example `npm run migrate && npm start`): nothing extra.
   - The image has a separate migrate entry point and no shell (distroless images, for example `./server migrate`): after the first deploy, run it once over SSH with the app's own image, env, and network:
     `ssh <user>@<ip> 'IMG=$(sudo docker service inspect <appName> --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"); sudo docker service inspect <appName> --format "{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}" | grep . > /tmp/app.env; sudo docker run --rm --network dokploy-network --env-file /tmp/app.env "$IMG" ./server migrate; rm -f /tmp/app.env'`
     Repeat it after any deploy that adds a migration. Until migrations run, the app can start and pass its health check while every database request returns 500.

MySQL, MariaDB, MongoDB, and Redis follow the same pattern under their own domains.

## 6. Deploy

1. `dokploy application deploy --applicationId <id>`.
2. Wait with one command: `dokploy deployment wait --applicationId <id>`. It returns when the newest deployment finishes: exit 0 `done`, 3 `error` (it prints the `readLogs` command), 4 timed out. Never wait with a shell loop (`while`, `until`, `for` with `sleep`): agent sandboxes block those or ask for approval on every poll. This needs dokploy-kit 2.2 or later; on an older version, check `dokploy deployment all --applicationId <id>` once a minute with separate commands.
3. On `error`, read the build log with `dokploy deployment readLogs --deploymentId <id> --tail 200`, and runtime logs with `dokploy application readLogs --applicationId <id> --tail 200`. Fix the cause. The most common causes are in the table below.

## 7. Domain

- **No domain yet:** get a free host with `dokploy domain generateDomain --appName <the application's appName>`. Current Dokploy returns an `sslip.io` name such as `<app>-<hash>-<ip-with-dashes>.sslip.io`, which resolves to the VPS IP and can get a real Let's Encrypt certificate, so create it with HTTPS on: `dokploy domain create --applicationId <id> --host <generated host> --path / --port <port> --https=true --certificateType letsencrypt`. The certificate arrives within about a minute, and HTTP redirects to HTTPS. Older Dokploy versions return a `traefik.me` host instead; those work only over HTTP, so use `--https=false --certificateType none` for them.
- **Own domain:** the user adds an A record pointing the domain or subdomain to the VPS IP. Then `dokploy domain create --applicationId <id> --host <domain> --path / --port <port> --https=true --certificateType letsencrypt`. The certificate is issued once DNS resolves to the server.

Application domain changes apply without a redeploy.

## 8. Verify

1. `curl -sI http://<domain>` (or `https://`) returns a success or redirect status. Right after the domain is created, HTTPS can fail for about a minute until the certificate arrives: check plain HTTP first, then HTTPS again on a later turn, without a `sleep`.
2. Ask the user to open it and run through the main flow.
3. Check the app's runtime logs for errors after the first real request.

## Redeploy and logs

- Private repository with the GitHub App: every push to the branch redeploys (verified: a push started a deploy within about 15 seconds, and data in the database was kept).
- Public repository on the custom git provider: a push does **not** redeploy on its own. Run `dokploy application deploy` again, or add the Dokploy webhook URL from the application's Deployments tab to the GitHub repository's webhooks.
- Rollback: redeploy an earlier commit, or use the Rollbacks feature in the panel when it is enabled.

## Common failures

| Symptom | Cause and fix |
|---|---|
| Build fails in seconds downloading `railpack-vnull` | `--railpackVersion` was set to `null`; set it to the server default with `saveBuildType` and redeploy |
| Build stops with `Killed` or exit 137 | Out of memory on a 2 GB server. Dokploy itself uses about 1.3 GB, and a small Node build pushed swap to about 850 MB in testing. Confirm swap exists, close other builds, or upgrade to a 4 GB plan |
| `Bad Gateway` on the domain | Wrong container port in the domain (check the Dockerfile's `EXPOSE`), or the app listens on `localhost` instead of `0.0.0.0` |
| Secrets visible inside the image (`.env` in `/app`) | `.dockerignore` does not exclude `.env`; Dokploy writes the environment there before building. Add it and redeploy |
| Every redeploy pauses about 10 s before the new version starts | The app runs as PID 1 and ignores stop signals; start it under `tini` as in the `dockerfile-for-dokploy` templates |
| Compose service keeps restarting with `MODULE_NOT_FOUND` | A file it runs is missing from the image it uses; check `.dockerignore`, the Dockerfile's `COPY`, and that the service builds from the current source |
| App crashes on start | Missing environment variable or failed database connection; read the runtime logs |
| Health check passes but sign-up, login, or saving returns 500 | Migrations have not run, so the tables do not exist; see step 5.5 |
| Login works locally but not live (auth apps such as Better Auth) | The auth base URL env var (for example `BETTER_AUTH_URL`) must be the public `https://` domain from step 7, and behind Traefik set the client-IP header the app expects (for example `TRUSTED_IP_HEADER=x-forwarded-for`) |
| Domain does not resolve | DNS not propagated yet, or the A record points to the wrong IP |
| HTTPS certificate not issued | DNS does not point to the server yet, or ports 80/443 are closed in the SumoPod firewall |

## Tested with

Dokploy v0.30.8 and dokploy-kit 2.2 on a SumoPod Tencent VPS (2 vCPU, 2 GB, Ubuntu 24.04), October 2026. Flags and defaults can change in later Dokploy versions; `--help` and the server's errors win.

## Completion

Done when the latest deployment is `done`, the domain responds, the user has opened the app, secrets live only in Dokploy, and the user knows how redeploys happen.
