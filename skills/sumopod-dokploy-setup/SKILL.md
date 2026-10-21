---
name: sumopod-dokploy-setup
description: Prepare a fresh SumoPod VPS (or another Ubuntu VPS) and install Dokploy on it, from buying the server to creating a Dokploy API key. Use when the user wants to set up a VPS, install Dokploy, or use SumoPod credits for hosting, or when dokploy-deploy needs a server that does not exist yet.
---

# SumoPod VPS + Dokploy setup

Dokploy is an open-source panel that makes your own VPS work like Vercel or Heroku: connect a GitHub repository, it builds and runs the app in Docker, and Traefik routes a domain to it. Reply in the user's language and go one step at a time; wait for the user to confirm each step that happens in a browser or dashboard.

This skill changes a remote server. Confirm the server IP with the user before the first command, and never run anything on a server the user has not named.

## 1. Buy the VPS (user, in the SumoPod dashboard)

Guide the user through Dashboard → VPS → Create:

- Provider: Tencent or Cloudeka by Lintasarta. Region: Jakarta for Indonesian users.
- OS: Ubuntu Server 24.04 LTS.
- Plan: at least 2 vCPU and 2 GB RAM. Dokploy needs 2 GB RAM and 30 GB disk. The 2 vCPU / 2 GB / 40 GB plan is the minimum.
- Warn: on Tencent, monthly egress bandwidth is a hard cap. When it runs out, the VPS shuts down until the next month. Usage is in the VPS Usage tab.

Then collect from the VPS Access tab: the public IP and the username. On Tencent Ubuntu the username is `ubuntu`, not `root`. The password stays with the user; never ask for it in the chat.

## 2. Firewall (user, in the SumoPod dashboard)

A new VPS has an "Allow All Request" rule in the Firewall tab. Leave it in place during setup. If the user tightens it later, these inbound TCP ports must stay open: 22 (SSH), 80 and 443 (websites), 3000 (Dokploy panel). Removing all rules locks out SSH; the fix is to re-add a rule from the dashboard and use the Web Console.

## 3. Connect

Prefer an SSH key so the agent can run commands without a password prompt:

1. If `~/.ssh/id_ed25519.pub` does not exist, run `ssh-keygen -t ed25519` (the user may press Enter for every prompt).
2. The user runs `ssh-copy-id <user>@<ip>` and types the VPS password into the terminal prompt. On Windows PowerShell, where `ssh-copy-id` is missing, use: `type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh <user>@<ip> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"`.
3. Test: `ssh -o BatchMode=yes <user>@<ip> 'whoami && lsb_release -ds'`.

If SSH does not work, the user can open the Web Console from the VPS page and paste the commands below one at a time.

## 4. Prepare the server

Run each over `ssh <user>@<ip> '<command>'` and show the output:

1. Check memory and swap: `free -h && swapon --show`.
2. If there is no swap, add 2 GB. Builds on a 2 GB server can run out of memory without it:
   `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`
3. Check that ports 80, 443, and 3000 are free: `sudo ss -tlnp | grep -E ':(80|443|3000)\s'`. No output means free. If something is listening, stop and ask the user; the Dokploy installer fails on a busy port.

## 5. Install Dokploy

`ssh <user>@<ip> 'curl -sSL https://dokploy.com/install.sh | sudo sh'`

It installs Docker if needed and takes a few minutes. When it finishes it prints the panel URL, `http://<ip>:3000`.

## 6. First login (user, in the browser)

1. Open `http://<ip>:3000` right away and create the admin account. Until someone does, anyone who finds the URL can claim the server.
2. Use a strong, unique password.
3. Create an API key for the agent under the user's profile or Settings, in the API Keys section. Dokploy sends it as the `x-api-key` header.
4. The user stores it in their own terminal, not in the chat and not in the repository:
   - macOS/Linux: `export DOKPLOY_BASE_URL="http://<ip>:3000/api"` and `export DOKPLOY_API_KEY="<key>"`, added to `~/.zshrc` or `~/.bashrc` to persist.
   - Windows PowerShell: `$env:DOKPLOY_BASE_URL="http://<ip>:3000/api"` and `$env:DOKPLOY_API_KEY="<key>"`.
   Then restart the agent from that terminal so it inherits the variables.

## 7. Verify

1. `curl -s -o /dev/null -w '%{http_code}\n' http://<ip>:3000` returns `200` or a redirect code.
2. `npx -y dokploy-kit project all` returns JSON (an empty list is fine). This confirms the API key works.

## Later hardening (mention, do not do unprompted)

- Point a domain at the IP and serve the Dokploy panel over HTTPS instead of port 3000.
- Then close port 3000 in the firewall.
- Turn on Dokploy two-factor authentication.

## Completion

Done when the panel loads, the admin account exists, the API key works from the agent's terminal, and the user knows the egress limit and the firewall ports. Continue with `dokploy-deploy`.
