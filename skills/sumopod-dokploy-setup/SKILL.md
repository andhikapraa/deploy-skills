---
name: sumopod-dokploy-setup
description: Prepare a fresh SumoPod VPS (or another Ubuntu VPS) and install Dokploy on it, from buying the server to creating a Dokploy API key. Use when the user wants to set up a VPS, install Dokploy, or use SumoPod credits for hosting, or when dokploy-deploy needs a server that does not exist yet.
license: MIT
compatibility: Needs ssh and Node.js 22.18+, an Ubuntu 24.04 VPS with 2 GB RAM or more (SumoPod or another provider), and the user at a terminal for passwords and the Dokploy API key.
---

# SumoPod VPS + Dokploy setup

Dokploy is an open-source panel that makes your own VPS work like Vercel or Heroku: connect a GitHub repository, it builds and runs the app in Docker, and Traefik routes a domain to it. Reply in the user's language and go one step at a time; wait for the user to confirm each step that happens in a browser or dashboard.

This skill changes a remote server. Confirm the server IP with the user before the first command, and never run anything on a server the user has not named.

Three secrets come up: the SumoPod session, the VPS password, and the Dokploy API key. The user types or pastes each one into their own terminal, into a command that reads it from a hidden prompt (`sumopod login`, `ssh-copy-id`, `dokploy login`). Never ask the user to send any of them in the chat, and if one is pasted into the chat anyway, do not use it: tell the user to revoke or rotate it.

Write commands for the user in plain POSIX shell (they work in bash and zsh), with a PowerShell variant where they differ. Do not guess the user's shell from the environment.

## 0. Update first

1. Run `npx -y skills@latest update -y`.
2. If it updated any skill, re-read this file before continuing.

## 1. Buy the VPS (user, in the SumoPod dashboard)

Buying happens only in the dashboard: SumoPod requires a captcha to create a VPS, and it spends the user's balance. Never try to create, renew, or upgrade a VPS from the terminal.

In your first reply, give the target before anything else: OS **Ubuntu Server 24.04 LTS 64bit**, at least **2 vCPU / 2 GB RAM / 30 GB disk**, region Jakarta. Then offer the two ways to pick a plan below.

`scripts/sumopod.mjs` in this skill's folder is a read-only SumoPod CLI. Below, `sumopod` means `node <this skill's folder>/scripts/sumopod.mjs`. It is optional: if the user does not want to paste a session, skip to the manual path at the end of this step.

1. **Sign in the CLI.** The user signs in at sumopod.com, opens the browser console (F12, or Cmd+Opt+I on Mac), and runs `copy(localStorage.getItem("sumopod-auth"))`. Then, in their own terminal window (not the chat), they run `sumopod login` and paste it there. Give them the full command with this skill's folder path. The session grants full access to their account. It ends about 1 hour after the browser sign-in, so take it right before use; on "token refresh failed", repeat this step.
2. **Check balance and pick a plan.** Run `sumopod whoami` for the balance, then `sumopod plans --region jakarta --provider tencent` (also `--provider cloudeka`, or `--region singapore`). Show the plans marked "cukup buat Dokploy" (at least 2 GB RAM and 30 GB disk) with their prices, and let the user choose. Recommend the cheapest one that fits. On Tencent, warn that the listed monthly egress is a hard cap: when it runs out, the VPS shuts down until the next month.
3. **The user buys it** at https://sumopod.com/dashboard/vps/create: the chosen provider and region, OS **Ubuntu Server 24.04 LTS 64bit** (not an app image such as "Hermes (Ubuntu 24.04)"), the chosen plan, then the captcha and Create.
4. **Wait for it.** Run `sumopod vps wait`. It polls every 15 seconds and prints `ready: <user>@<ip>` once the newest VPS is running with an IP. On Tencent Ubuntu the username is `ubuntu`, not `root`. Confirm that IP with the user before step 3.

Manual path: the user reads the public IP and username from the VPS Access tab and tells the agent. The VPS password stays with the user; never ask for it in the chat.

## 2. Firewall (user, in the SumoPod dashboard)

With the CLI signed in, `sumopod vps firewall <id>` lists the current rules (the id is in the `vps wait` output). A new VPS has an "Allow All Request" rule in the Firewall tab. Leave it in place during setup. If the user tightens it later, these inbound TCP ports must stay open: 22 (SSH), 80 and 443 (websites), 3000 (Dokploy panel). Removing all rules locks out SSH; the fix is to re-add a rule from the dashboard and use the Web Console.

## 3. Connect

Prefer an SSH key so the agent can run commands without a password prompt:

1. If `~/.ssh/id_ed25519.pub` does not exist, run `ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519`. The agent can run this itself; never overwrite an existing key.
2. Record the server's host key, so later non-interactive commands do not stop at "Host key verification failed": `ssh-keygen -R <ip> >/dev/null 2>&1; ssh-keyscan -T 10 -t ed25519 <ip> >> ~/.ssh/known_hosts`. The `-R` clears an old key for the same IP, which a reset VPS keeps. This writes outside the project folder, so the agent may need the user's approval; if it is refused, give the user this command to run together with step 3.
3. The user runs `ssh-copy-id <user>@<ip>` in their own terminal and types the VPS password at the prompt. On Windows PowerShell, where `ssh-copy-id` is missing, use: `type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh <user>@<ip> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"`.
4. Test: `ssh -o BatchMode=yes -o ConnectTimeout=10 <user>@<ip> 'whoami && lsb_release -ds'`. It must print the username and Ubuntu 24.04 without asking for anything.

If SSH does not work, the user can open the Web Console from the VPS page and paste the commands below one at a time.

## 4. Prepare the server

Run each over `ssh <user>@<ip> '<command>'` and show the output:

1. Check that `sudo` works without a password: `sudo -n true && echo ok`. It does for `ubuntu` on SumoPod's Tencent images. If it asks for a password, have the user run the commands below themselves in their own SSH session.
2. Check memory and swap: `free -h && swapon --show`. SumoPod's Tencent Ubuntu 24.04 image already ships a 2 GB `/swap.img`, so usually nothing to do. Only if there is no swap at all, add 2 GB, because builds on a 2 GB server can run out of memory without it:
   `[ -f /swapfile ] || { sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && { grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab; }; }`
3. Check that ports 80, 443, and 3000 are free: `sudo ss -tlnp | grep -E ':(80|443|3000)\s'`. No output means free. If something is listening, stop and ask the user; the Dokploy installer fails on a busy port.

## 5. Install Dokploy

Download first, then run, so a failed download never runs half a script. Use the installer attached to a Dokploy release, not the moving `dokploy.com/install.sh`, so every run installs the same reviewed script and version. 1. Find the newest release tag (it looks like `v0.30.8`) and tell the user which version will be installed:
   `ssh <user>@<ip> 'curl -fsSL -o /dev/null -w "%{url_effective}\n" https://github.com/Dokploy/dokploy/releases/latest'` prints a URL ending in `/tag/<tag>`.
2. Download that release's script, then run it:
   `ssh <user>@<ip> 'curl -fsSL https://github.com/Dokploy/dokploy/releases/download/<tag>/install.sh -o /tmp/dokploy-install.sh && sudo bash /tmp/dokploy-install.sh'`

It installs Docker if needed and takes a few minutes. When it finishes it prints the panel URL, `http://<ip>:3000`.

## 6. First login (user, in the browser)

1. Open `http://<ip>:3000` right away and create the admin account. Until someone does, anyone who finds the URL can claim the server.
2. Use a strong, unique password.
   After sign-up, Dokploy shows a welcome and tutorial walkthrough. Tell the user they can click Next through it, or use Skip at the bottom left; nothing in it is required for this setup.
3. Create an API key for the agent: in Dokploy, open **Settings → Profile → API/CLI** and generate a key.
4. Save it with `dokploy login`. The user runs this in a separate terminal window, not through the agent: the key prompt is hidden and needs a real terminal, which Claude Code's `!` prefix and agent Bash tools do not provide.
   ```bash
   npx -y dokploy-kit@2 login --url http://<ip>:3000
   ```
   It asks for the key (typing is hidden), checks it against the server, and saves the URL and key to `~/.config/dokploy/config.json` (mode 600). The same command works on macOS, Linux, and Windows, and every agent reads the saved file, including desktop apps such as Antigravity. Never ask for the key in the chat or pass it as a command argument.

## 7. Verify

1. `curl -s -o /dev/null -w '%{http_code}\n' http://<ip>:3000` returns `200` or a redirect code.
2. `npx -y dokploy-kit@2 project all` returns JSON (an empty list is fine). This confirms the saved login works from the agent. If it says "Not logged in", step 6.4 has not been done yet.

## Later hardening (mention, do not do unprompted)

- Point a domain at the IP and serve the Dokploy panel over HTTPS instead of port 3000.
- Then close port 3000 in the firewall.
- Turn on Dokploy two-factor authentication.

## Completion

Done when the panel loads, the admin account exists, `dokploy login` succeeded and `project all` works from the agent, and the user knows the egress limit and the firewall ports. Continue with `dokploy-deploy`.
