---
name: dokploy-deploy
description: Deploy a GitHub repository to an existing Dokploy server as an application, optionally with a Postgres database and a domain, then redeploy and read logs. Use when the user wants to deploy a backend, full-stack app, Docker app, or database-backed app to Dokploy or their VPS, or when deploy-router chose Dokploy.
---

# Deploy to Dokploy

Reply in the user's language and explain each Dokploy concept once: a **project** groups related services, an **environment** (such as `production`) lives inside a project, and an **application** is one running service built from a repository.

Requires a working Dokploy server and API key. If `DOKPLOY_BASE_URL` or `DOKPLOY_API_KEY` is not set in the agent's environment, use `sumopod-dokploy-setup` first, or ask the user to set them in their terminal and restart the agent. Never ask for the key in the chat.

## CLI

Use the `dokploy` CLI from the `dokploy-kit` npm package:

```bash
if command -v dokploy >/dev/null 2>&1; then dokploy "$@"; else npx -y dokploy-kit "$@"; fi
```

Commands look like `dokploy <domain> <action> --flag value`. Dokploy's API changes between versions, so run `dokploy <domain> <action> --help` before every action you have not run in this session and use the flags it shows. If `--help` disagrees with this file, follow `--help`.

Some actions mark nullable fields as required (for example `saveBuildType` requires `--dockerfile`, `--dockerContextPath`, `--dockerBuildStage`, `--herokuVersion`, `--railpackVersion`). Pass `null` for the ones that do not apply, such as `--dockerfile null`. Booleans take `--flag=true` or `--flag=false`.

Actions named `delete`, `remove`, `stop`, or `kill` take effect immediately. Ask the user first, naming the exact resource.

## 1. Source

The repository must be on GitHub. Choose the branch:

- **Public repository:** use the custom git provider with the HTTPS clone URL. No GitHub connection is needed.
- **Private repository:** the user connects GitHub once in the Dokploy panel under Settings, then Git, then GitHub, which creates a GitHub App. After that, use the GitHub provider action. Pushes then trigger automatic deploys.

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
| Has a `Dockerfile` | `dockerfile` |
| Node, Python, PHP, Go without a Dockerfile | `railpack` (the successor to Nixpacks), or `nixpacks` if railpack is unavailable |
| Static site or single-page app that only needs serving | `static` with `--publishDirectory dist` (the build output) and `--isStaticSpa=true` for client-side routers; this serves on port `80` |

Note the port the app listens on (for example `3000` for Next.js and most Express apps, `4321` for Astro, `80` for static). The app should listen on `0.0.0.0` and read the port from `PORT` when it can.

## 4. Environment variables

`dokploy application saveEnvironment --help`, then send `--env` with one `KEY=value` per line, `--buildArgs null`, `--buildSecrets null`, and `--createEnvFile=true`. Ask the user for each secret value and send it directly in the command without writing it to any file in the repository. Remind the user that changing variables requires a redeploy.

## 5. Database (only if the app needs one)

1. `dokploy postgres create --help`, then create it in the same environment with a database name, user, and a generated strong password.
2. `dokploy postgres deploy --postgresId <id>`.
3. Read the internal connection details from `dokploy postgres one --postgresId <id>`. Apps in the same Dokploy server connect through the internal host name, not the public IP.
4. Save `DATABASE_URL=postgresql://<user>:<password>@<internal-host>:5432/<db>` in the application's environment.
5. Run migrations the way the project expects, for example as part of the start command.

MySQL, MariaDB, MongoDB, and Redis follow the same pattern under their own domains.

## 6. Deploy

1. `dokploy application deploy --applicationId <id>`.
2. Watch progress: `dokploy deployment all --applicationId <id>` until the newest deployment is `done` or `error`.
3. On `error`, read the build log with `dokploy deployment readLogs --deploymentId <id> --tail 200`, and runtime logs with `dokploy application readLogs --applicationId <id> --tail 200`. Fix the cause. The most common causes are in the table below.

## 7. Domain

- **No domain yet:** get a free `traefik.me` host with `dokploy domain generateDomain --appName <the application's appName>`, then `dokploy domain create --applicationId <id> --host <generated host> --path / --port <port> --https=false --certificateType none`. These domains are HTTP only.
- **Own domain:** the user adds an A record pointing the domain or subdomain to the VPS IP. Then `dokploy domain create --applicationId <id> --host <domain> --path / --port <port> --https=true --certificateType letsencrypt`. The certificate is issued once DNS resolves to the server.

Application domain changes apply without a redeploy.

## 8. Verify

1. `curl -sI http://<domain>` (or `https://`) returns a success or redirect status.
2. Ask the user to open it and run through the main flow.
3. Check the app's runtime logs for errors after the first real request.

## Redeploy and logs

- Private repository with the GitHub App: every push to the branch redeploys.
- Public repository: run `dokploy application deploy` again, or add the Dokploy webhook URL from the application's Deployments tab to the GitHub repository's webhooks.
- Rollback: redeploy an earlier commit, or use the Rollbacks feature in the panel when it is enabled.

## Common failures

| Symptom | Cause and fix |
|---|---|
| Build stops with `Killed` or exit 137 | Out of memory on a 2 GB server. Confirm swap exists, close other builds, or upgrade the VPS |
| `Bad Gateway` on the domain | Wrong container port in the domain, or the app listens on `localhost` instead of `0.0.0.0` |
| App crashes on start | Missing environment variable or failed database connection; read the runtime logs |
| Domain does not resolve | DNS not propagated yet, or the A record points to the wrong IP |
| HTTPS certificate not issued | DNS does not point to the server yet, or ports 80/443 are closed in the SumoPod firewall |

## Completion

Done when the latest deployment is `done`, the domain responds, the user has opened the app, secrets live only in Dokploy, and the user knows how redeploys happen.
