---
name: dokploy-deploy
description: Deploy a GitHub repository to an existing Dokploy server as an application, optionally with a Postgres database and a domain, then redeploy and read logs. Use when the user wants to deploy a backend, full-stack app, Docker app, or database-backed app to Dokploy or their VPS, or when deploy-router chose Dokploy.
---

# Deploy to Dokploy

Reply in the user's language and explain each Dokploy concept once: a **project** groups related services, an **environment** (such as `production`) lives inside a project, and an **application** is one running service built from a repository.

## 0. Update first

1. Run `npx -y skills@latest update -y`.
2. If it updated any skill, re-read this file before continuing.

Requires a working Dokploy server and a saved login. Check with `npx -y dokploy-kit@latest project all`. If it says "Not logged in": with no server yet, use `sumopod-dokploy-setup`; with a server, ask the user to run `npx -y dokploy-kit@latest login --url <panel-url>` in a separate terminal window (the hidden key prompt needs a real terminal), then check again. Never ask for the key in the chat.

## CLI

Use the latest `dokploy-kit` from npm, so a stale global install never answers:

```bash
npx -y dokploy-kit@latest <domain> <action> --flag value
```

Below, `dokploy ...` is short for `npx -y dokploy-kit@latest ...`.

The CLI's built-in schema can lag behind the server: check the server version with `dokploy settings getDokployVersion`. When an action fails with a validation error the CLI did not predict, trust the server's error message over `--help`.

Commands look like `dokploy <domain> <action> --flag value`. Dokploy's API changes between versions, so run `dokploy <domain> <action> --help` before every action you have not run in this session and use the flags it shows. If `--help` disagrees with this file, follow `--help`.

Some actions mark nullable fields as required (for example `saveBuildType` requires `--dockerfile`, `--dockerContextPath`, `--dockerBuildStage`, `--herokuVersion`, `--railpackVersion`). Pass `null` for the ones that do not apply, such as `--dockerfile null`. Booleans take `--flag=true` or `--flag=false`.

Exception: for the `railpack` build type, `--railpackVersion` must be a real version. `null` makes the build download railpack `vnull` and fail in seconds. Use the version the server defaults to, read with `dokploy application one --applicationId <id>` after creating any app (Dokploy v0.30.8 uses `0.15.4`).

Actions named `delete`, `remove`, `stop`, or `kill` take effect immediately. Ask the user first, naming the exact resource.

## 1. Source

The repository must be on GitHub. Choose the branch:

- **Public repository:** use the custom git provider with the HTTPS clone URL. No GitHub connection is needed.
- **Private repository:** the user connects GitHub once in the Dokploy panel: Settings → Git → GitHub → Create GitHub App, then Install it on GitHub. Tell them to choose **Only select repositories** and pick just the repository to deploy; "All repositories" lets the Dokploy server clone every repo they own. Then find the provider with `dokploy github githubProviders` (keep its `githubId`) and confirm with `dokploy github testConnection --githubId <id>`, which reports how many repositories it can see. After that, use the GitHub provider action. Pushes then trigger automatic deploys.

## 2. Create the application

1. `dokploy project all`. Reuse a project with the right name, or `dokploy project create --name <name>`.
2. Find the environment: check the project from `project one` or `environment byProjectId`. Recent Dokploy versions create `production` automatically; create one only if none exists.
3. `dokploy application create --environmentId <id> --name <name>` and keep the returned `applicationId`.
4. Attach the source:
   - public: `dokploy application saveGitProvider --help`, then set `--customGitUrl` to the HTTPS clone URL, `--customGitBranch` (usually `main`), `--customGitBuildPath /`, and `--watchPaths null`;
   - private: `dokploy application saveGithubProvider --help`, then set owner, repository, branch, `--buildPath /`, `--triggerType push`, and the `githubId` of the connected GitHub App (from `dokploy github githubProviders`).

## 3. Build type

Check `dokploy application saveBuildType --help`. Choose:

| Project | Build type |
|---|---|
| Has a `Dockerfile` | `dockerfile` with `--dockerfile Dockerfile --dockerContextPath .` (paths relative to the build path) and `null` for the rest. Read the Dockerfile first: its `EXPOSE`, required env vars, and any migrate step decide steps 4 and 5 |
| Node, Python, PHP, Go without a Dockerfile | `railpack` (the successor to Nixpacks) with `--railpackVersion 0.15.4` or the server's current default, never `null`; or `nixpacks` if railpack is unavailable |
| Static site or single-page app that only needs serving | `static` with `--publishDirectory dist` (the build output) and `--isStaticSpa=true` for client-side routers; this serves on port `80` |

Note the port the app listens on (for example `3000` for Next.js and most Express apps, `4321` for Astro, `80` for static). The app should listen on `0.0.0.0` and read the port from `PORT` when it can.

## 4. Environment variables

`dokploy application saveEnvironment --help`, then send `--env` with one `KEY=value` per line, `--buildArgs null`, `--buildSecrets null`, and `--createEnvFile=true`. Ask the user for each secret value and send it directly in the command without writing it to any file in the repository. Remind the user that changing variables requires a redeploy.

## 5. Database (only if the app needs one)

1. `dokploy postgres create --help`, then create it in the same environment with a database name, user, and a generated strong password.
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
2. Watch progress: `dokploy deployment all --applicationId <id>` until the newest deployment is `done` or `error`.
3. On `error`, read the build log with `dokploy deployment readLogs --deploymentId <id> --tail 200`, and runtime logs with `dokploy application readLogs --applicationId <id> --tail 200`. Fix the cause. The most common causes are in the table below.

## 7. Domain

- **No domain yet:** get a free host with `dokploy domain generateDomain --appName <the application's appName>`. Current Dokploy returns an `sslip.io` name such as `<app>-<hash>-43-173-20-68.sslip.io`, which resolves to the VPS IP and can get a real Let's Encrypt certificate, so create it with HTTPS on: `dokploy domain create --applicationId <id> --host <generated host> --path / --port <port> --https=true --certificateType letsencrypt`. The certificate arrives within about a minute, and HTTP redirects to HTTPS. Older Dokploy versions return a `traefik.me` host instead; those work only over HTTP, so use `--https=false --certificateType none` for them.
- **Own domain:** the user adds an A record pointing the domain or subdomain to the VPS IP. Then `dokploy domain create --applicationId <id> --host <domain> --path / --port <port> --https=true --certificateType letsencrypt`. The certificate is issued once DNS resolves to the server.

Application domain changes apply without a redeploy.

## 8. Verify

1. `curl -sI http://<domain>` (or `https://`) returns a success or redirect status.
2. Ask the user to open it and run through the main flow.
3. Check the app's runtime logs for errors after the first real request.

## Redeploy and logs

- Private repository with the GitHub App: every push to the branch redeploys (verified: a push started a deploy within about 15 seconds, and data in the database was kept).
- Public repository on the custom git provider: a push does **not** redeploy on its own. Run `dokploy application deploy` again, or add the Dokploy webhook URL from the application's Deployments tab to the GitHub repository's webhooks.
- Rollback: redeploy an earlier commit, or use the Rollbacks feature in the panel when it is enabled.

## Common failures

| Symptom | Cause and fix |
|---|---|
| Build fails in seconds downloading `railpack-vnull` | `--railpackVersion` was set to `null`; set it to `0.15.4` (or the server default) with `saveBuildType` and redeploy |
| Build stops with `Killed` or exit 137 | Out of memory on a 2 GB server. Dokploy itself uses about 1.3 GB, and a small Node build pushed swap to about 850 MB in testing. Confirm swap exists, close other builds, or upgrade to a 4 GB plan |
| `Bad Gateway` on the domain | Wrong container port in the domain, or the app listens on `localhost` instead of `0.0.0.0` |
| App crashes on start | Missing environment variable or failed database connection; read the runtime logs |
| Health check passes but sign-up, login, or saving returns 500 | Migrations have not run, so the tables do not exist; see step 5.5 |
| Login works locally but not live (auth apps such as Better Auth) | The auth base URL env var (for example `BETTER_AUTH_URL`) must be the public `https://` domain from step 7, and behind Traefik set the client-IP header the app expects (for example `TRUSTED_IP_HEADER=x-forwarded-for`) |
| Domain does not resolve | DNS not propagated yet, or the A record points to the wrong IP |
| HTTPS certificate not issued | DNS does not point to the server yet, or ports 80/443 are closed in the SumoPod firewall |

## Completion

Done when the latest deployment is `done`, the domain responds, the user has opened the app, secrets live only in Dokploy, and the user knows how redeploys happen.
