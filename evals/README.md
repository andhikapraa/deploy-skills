# Evals

Each skill has a runbook here: realistic prompts (casual Indonesian, as students type them, usually without naming the skill), the behavior that must happen, what must not happen, and how to check it.

## How to run

1. Copy a fixture project (listed per prompt) into an empty folder, `git init` it, and install the skills: `npx skills add andhikapraa/deploy-skills -a claude-code -y`.
2. Start a fresh agent session in that folder, with no earlier conversation.
3. Send the prompt exactly as written.
4. Check every item under **Expected** and **Must not**, then run the **Check** commands.
5. Record pass or fail per prompt, with the agent, model, and date.

Prompts marked *isolated* run with `XDG_CONFIG_HOME` pointing to an empty folder, so the agent has no Cloudflare or Dokploy login and cannot publish anything. Prompts marked *live* use a real Dokploy server; delete what they create afterwards.

## Fixtures

| Name | What it is |
|---|---|
| `vite-app` | `npm create vite@latest -- --template react-ts`, no changes |
| `express` | Express 5 + `pg`, `server.js` reads `PORT`, `GREETING`, `DATABASE_URL`; no Docker files |
| `next-app` | `create-next-app` (App Router, TypeScript, Tailwind), no `output` setting, no Docker files |
| `vite-uncommitted` | `vite-app` plus a committed `App.tsx` that imports `src/Promo.tsx`, which stays uncommitted (listed in `.eval-keep-untracked`) |

## Results

| Date | Agent / model | Pass | Notes |
|---|---|---|---|
| 2026-10-22 | Claude Code / Opus 5.5 | rehearsals | Three full rehearsals (Cloudflare, VPS setup to live app, Dockerfile to live app) before these runbooks; findings already in the skills |
| 2026-10-22 | Claude Code / Sonnet 5.5 | 10/10 after fixes | First round failed K1: chose railpack without asking, skipped Postgres, created the app twice, waited with `sleep`. Fixed in `dokploy-deploy`, then passed |
| 2026-10-22 | Claude Code / Haiku 4.5 | 8/10 after fixes | Failed first: C1 (build without `npm ci`), S1 (offered the SumoPod session in chat), K1 (sent to VPS setup despite a saved login); those are fixed. Still failing: C1 offers the temporary account without naming the Worker or saying it is public; K1 push gate held in 2 of 3 runs, the third pushed without asking and claimed pushes auto-redeploy |
| 2026-10-23 | Claude Code / Sonnet 5.5 + Haiku 4.5 | 4/4 after one fix | New clean-run step (`deploy-router` readiness 1): R4 and R1. First round, both models tried `mktemp`, `cd`, or `$(...)` chains that Claude Code's permission prompts blocked; Haiku fell back to building in the working folder. Rewrote the step as single commands (`git worktree add` next to the project, `npm ci --prefix`, `npm run build --prefix`, `git worktree remove`), then all four passed: R4 found the uncommitted `Promo.tsx` from the failed clean build, R1 built clean, no leftover worktree, no commit without asking |
| 2026-10-23 | Claude Code / Sonnet 5.5 | C3, K3 2/2 each (round 1) | Participant simulation, skills installed from GitHub, multi-turn by resume. Cloudflare temporary account deployed and served 200 both runs, but run 2 served Cloudflare's "Just a moment..." bot check (403, also in a real browser) for about 7 minutes, and the agent could not tell the user whether it worked; `cf init` failed once per run without `npm ci`; the router told an account-less user they need a Cloudflare account. Dokploy: both runs asked before push and reached `/` and `/db` 200 over HTTPS, but run 2 asked the user whether the repo is public, left `/` and `/db` for the user to check after curl exit 60 (certificate pending), and run 1 hit an approval prompt from an `A=<id>;` chain. Fixed in `deploy-router`, `cloudflare-deploy`, `dokploy-deploy` |
| | Antigravity | not run | `agy` was not signed in on the test machine |

Not yet run: K2, S2 (manual, needs a VPS reset), R4 on a Dokploy route, and every prompt on Antigravity.
