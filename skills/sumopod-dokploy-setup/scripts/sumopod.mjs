#!/usr/bin/env node
// sumopod — read-only CLI over SumoPod's dashboard data. Ships inside the sumopod-dokploy-setup skill.
//
// Auth model: SumoPod logs in through Supabase. Its browser session (localStorage
// key "sumopod-auth") holds an access_token and a refresh_token. This CLI stores that
// session locally and, when the access_token is near expiry, exchanges the refresh_token
// for a fresh one. SumoPod also caps the whole session at about 1 hour from the browser
// sign-in (measured: rejected at 66 min despite refreshes every 10 min), after which
// the user must sign in again in the browser and paste a new session.
//
// It never prints the tokens or VPS passwords. Mutating VPS actions (create, renew,
// upgrade, reinstall, reset) are intentionally absent; do those in the dashboard.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const SUPABASE_URL = 'https://dhsrwbufpdvuptdzeieo.supabase.co';
const GATE = 'https://api-gate-v2.sumopod.com/webhook/sumopod';
// Public anon key shipped in the dashboard's JS bundle (safe to embed; it is not a secret).
const ANON_KEY =
  process.env.SUMOPOD_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoc3J3YnVmcGR2dXB0ZHplaWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0NTQ4NTUsImV4cCI6MjA2MjAzMDg1NX0.7dhHHFZZArMOQgFwehICyjY-QKehZ9gvrVt8hOXTJX0';

const CONFIG_DIR = process.env.SUMOPOD_CONFIG_DIR || path.join(os.homedir(), '.config', 'sumopod');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');

const die = (msg, code = 1) => { console.error(`error: ${msg}`); process.exit(code); };
const isJson = () => process.argv.includes('--json');

function decodeJwt(t) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')); }
  catch { return null; }
}

function readSession() {
  if (process.env.SUMOPOD_SESSION) {
    try { return normalizeSession(JSON.parse(process.env.SUMOPOD_SESSION)); }
    catch { die('SUMOPOD_SESSION is set but is not valid JSON'); }
  }
  if (!fs.existsSync(SESSION_FILE)) {
    die(`not logged in. Run: sumopod login   (paste the sumopod-auth session from your browser)`);
  }
  try { return normalizeSession(JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))); }
  catch { die(`session file is corrupt: ${SESSION_FILE}`); }
}

// Accept either a raw GoTrue session or the localStorage wrapper the dashboard stores.
function normalizeSession(obj) {
  const s = obj && typeof obj === 'object' && obj.access_token ? obj
    : obj && obj.currentSession ? obj.currentSession
    : obj;
  if (!s || !s.access_token) die('session has no access_token. Copy the whole sumopod-auth value.');
  if (!s.refresh_token) die('session has no refresh_token. Copy the whole sumopod-auth value, not just the access_token.');
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || 0 };
}

function writeSession(s) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
}

// Return a valid access_token, refreshing in place when it is within 2 min of expiry.
async function getAccessToken(session, { persist }) {
  const claims = decodeJwt(session.access_token);
  const now = Math.floor(Date.now() / 1000);
  const exp = claims?.exp || session.expires_at || 0;
  if (exp - now > 120) return session.access_token;

  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) {
    die(`token refresh failed (HTTP ${r.status}). SumoPod sessions end about 1 hour after the browser sign-in. Sign in again at sumopod.com, then run: sumopod login`);
  }
  const fresh = {
    access_token: body.access_token,
    refresh_token: body.refresh_token || session.refresh_token,
    expires_at: body.expires_at || (now + (body.expires_in || 3600)),
  };
  if (persist) writeSession(fresh);
  Object.assign(session, fresh);
  return fresh.access_token;
}

async function supa(session, pathAndQuery, { persist }) {
  const token = await getAccessToken(session, { persist });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) die(`Supabase ${r.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function gate(session, path, { method = 'GET', payload, persist }) {
  const token = await getAccessToken(session, { persist });
  const r = await fetch(`${GATE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) die(`api-gate ${r.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

// VPS rows: SumoPod's column names are inconsistent (bandwidth_usage is spelled
// correctly, the limit column is the typo "bandwith_limit"). Read both spellings.
function shapeVps(v) {
  return {
    id: v.id,
    name: v.name,
    status: v.status,
    os: v.operating_system,
    cpu: v.cpu,
    ram_mb: v.ram,
    storage_gb: v.storage_in_gb,
    ip: v.ip_address,
    username: v.username,
    region: v.region,
    plan: v.plan,
    expires_at: v.expired_at,
    bandwidth_usage: v.bandwidth_usage ?? v.bandwith_usage ?? null,
    bandwidth_limit: v.bandwidth_limit ?? v.bandwith_limit ?? null,
  };
}

const VPS_COLS =
  'id,name,status,type,cpu,ram,storage_in_gb,operating_system,ip_address,username,region,plan,expired_at,bandwidth_usage,bandwith_limit';

async function saveAndGreet(s) {
  writeSession(s);
  const who = await supa(s, 'profiles?select=email', { persist: true });
  const email = Array.isArray(who) && who[0] ? who[0].email : '(unknown)';
  console.log(`logged in as ${email}. Session saved to ${SESSION_FILE} (auto-refreshes).`);
}

// Login by pasting the dashboard's sumopod-auth session. SumoPod's auth server blocks
// CLI-only sign-in: email OTP requires a Turnstile captcha, and Google OAuth only
// redirects back to sumopod.com. After this one paste, the session auto-refreshes.
async function cmdLogin() {
  process.stderr.write(
    'Paste your SumoPod session, then press Enter.\n' +
    'Get it in the dashboard browser console with:\n' +
    '  copy(localStorage.getItem("sumopod-auth"))\n> '
  );
  const input = await readStdinLine();
  let parsed;
  try { parsed = JSON.parse(input.trim()); }
  catch { die('that was not valid JSON. Copy the whole sumopod-auth value.'); }
  const s = normalizeSession(parsed);
  // Force a refresh immediately to confirm the refresh_token works and to normalize expiry.
  await getAccessToken(s, { persist: false });
  await saveAndGreet(s);
}

// Resolve on the first complete JSON value, so a pasted session followed by Enter
// finishes without needing Ctrl-D. Piped input (EOF) also works.
function readStdinLine() {
  return new Promise((resolve) => {
    let data = '';
    const done = () => { process.stdin.pause(); resolve(data); };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => {
      data += c;
      if (data.includes('\n')) {
        try { JSON.parse(data.trim()); done(); } catch { /* keep reading a multi-line paste */ }
      }
    });
    process.stdin.on('end', done);
  });
}

async function cmdWhoami(session) {
  const rows = await supa(session, 'profiles?select=email,full_name,company', { persist: true });
  const p = Array.isArray(rows) && rows[0] ? rows[0] : {};
  // The dashboard reads the account credit from user_balances.credits.
  const bal = await supa(session, 'user_balances?select=credits', { persist: true });
  const out = { email: p.email, name: p.full_name, company: p.company, balance: bal?.[0]?.credits ?? null };
  console.log(isJson() ? JSON.stringify(out, null, 2) : `${out.email || '(unknown)'}${out.balance != null ? `  balance: Rp ${out.balance}` : ''}`);
}

async function cmdVpsList(session) {
  const rows = await supa(session, `vps?select=${VPS_COLS}&order=created_at.desc`, { persist: true });
  const list = (Array.isArray(rows) ? rows : []).map(shapeVps);
  if (isJson()) return console.log(JSON.stringify(list, null, 2));
  if (!list.length) return console.log('no VPS yet. Create one in the dashboard: https://sumopod.com/dashboard/vps');
  for (const v of list) {
    console.log(`${v.name}  [${v.status}]  ${v.ip || '-'}  ${v.username || '-'}  ${v.cpu}vCPU/${v.ram_mb}MB  ${v.os}  ${v.region}  id=${v.id}`);
  }
}

async function cmdVpsGet(session, id) {
  if (!id) die('usage: sumopod vps get <id>');
  const rows = await supa(session, `vps?select=${VPS_COLS}&id=eq.${encodeURIComponent(id)}`, { persist: true });
  const v = Array.isArray(rows) && rows[0] ? shapeVps(rows[0]) : null;
  if (!v) die('no VPS with that id for this account');
  console.log(JSON.stringify(v, null, 2));
}

async function cmdVpsFirewall(session, id) {
  if (!id) die('usage: sumopod vps firewall <id>');
  const body = await gate(session, 'vps/list-firewall', { method: 'POST', payload: { id }, persist: true });
  const rules = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
  if (isJson()) return console.log(JSON.stringify(rules, null, 2));
  if (!rules.length) return console.log('no firewall rules (or firewall disabled)');
  for (const r of rules) console.log(JSON.stringify(r));
}

async function cmdProviders(session) {
  const body = await gate(session, 'vps/providers', { method: 'GET', persist: true });
  const list = Array.isArray(body) ? body : (body?.data || []);
  console.log(isJson() ? JSON.stringify(list, null, 2)
    : list.map((p) => `${p.name}  enabled=${p.is_enabled}  available=${p.is_available}  regions=${(p.available_regions || []).join(',')}`).join('\n'));
}

// Plans and prices for one provider + region, for an Ubuntu image. Mirrors the
// dashboard's create page: vps/images gives the OS images, vps/options the plans.
async function cmdPlans(session, flags) {
  const region = flags.region || 'jakarta';
  const provider = flags.provider || 'tencent';
  const imagesUrl = `vps/images?${new URLSearchParams({ region, provider })}`;
  const images = await gate(session, imagesUrl, { method: 'GET', persist: true });
  const imageList = Array.isArray(images) ? images : (images?.data || []);
  // Plain Ubuntu only: app images such as "Hermes (Ubuntu 24.04)" also mention it.
  const ubuntu = imageList.find((i) => i.slug === 'ubuntu_24_04') || null;
  const osType = ubuntu?.os_type || 'linux';
  const optsUrl = `vps/options?${new URLSearchParams({ region, os_type: osType, provider })}`;
  const opts = await gate(session, optsUrl, { method: 'GET', persist: true });
  // vps/options reports memory and storage in GB; egress ("bandwith", sic) in GB/month.
  const plans = (Array.isArray(opts) ? opts : (opts?.data || []))
    .filter((o) => o.is_show !== false && o.is_enable !== false)
    .map((o) => ({
      id: o.id,
      cpu: o.cpu,
      memory_gb: o.memory,
      storage_gb: o.storage,
      egress_gb_per_month: o.egress_bandwidth ?? o.egress_bandwith ?? null,
      price_idr: o.price_in_idr,
      available: o.is_available !== false && o.is_out_stock !== true,
    }));
  const out = { region, provider, ubuntu_24_04_image: ubuntu ? ubuntu.name || ubuntu.slug : null, plans };
  if (isJson()) return console.log(JSON.stringify(out, null, 2));
  console.log(`${provider} / ${region}  image: ${out.ubuntu_24_04_image || '(Ubuntu 24.04 not listed)'}`);
  for (const p of plans) {
    // Dokploy needs 2 GB RAM and 30 GB disk.
    const fits = p.available && p.memory_gb >= 2 && p.storage_gb >= 30 ? '  <- cukup buat Dokploy' : '';
    const egress = p.egress_gb_per_month ? `, egress ${p.egress_gb_per_month} GB` : '';
    console.log(`  ${p.cpu} vCPU / ${p.memory_gb} GB RAM / ${p.storage_gb} GB${egress}  Rp ${Number(p.price_idr).toLocaleString('id-ID')}/bulan${p.available ? '' : '  (habis)'}${fits}`);
  }
  console.log('Buy in the dashboard: https://sumopod.com/dashboard/vps/create');
}

// Wait until the newest VPS is running with an IP, so the agent can continue
// right after the user finishes buying in the dashboard.
async function cmdVpsWait(session, flags) {
  const timeoutMin = Number(flags.timeout || 15);
  const deadline = Date.now() + timeoutMin * 60_000;
  let last = '';
  for (;;) {
    const rows = await supa(session, `vps?select=${VPS_COLS},created_at&order=created_at.desc&limit=1`, { persist: true });
    const v = Array.isArray(rows) && rows[0] ? shapeVps(rows[0]) : null;
    const state = v ? `${v.name} [${v.status}] ${v.ip || 'no IP yet'}` : 'no VPS yet';
    if (state !== last) { process.stderr.write(`${new Date().toLocaleTimeString()}  ${state}\n`); last = state; }
    if (v && v.ip && /^(active|running|online)$/i.test(String(v.status))) {
      return console.log(isJson() ? JSON.stringify(v, null, 2) : `ready: ${v.username}@${v.ip}  (${v.os}, ${v.cpu} vCPU / ${v.ram_mb} MB, id=${v.id})`);
    }
    if (Date.now() > deadline) die(`no running VPS with an IP after ${timeoutMin} min (last: ${state})`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    if (m[2] !== undefined) flags[m[1]] = m[2];
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[m[1]] = argv[++i];
    else flags[m[1]] = true;
  }
  return flags;
}

function usage() {
  console.log(`sumopod — read-only SumoPod CLI (session lasts about 1 hour)

Usage:
  sumopod login                 Paste your browser session (valid ~1 hour from browser sign-in)
  sumopod whoami                Show the signed-in account and balance
  sumopod plans [--region jakarta|singapore] [--provider tencent]
                                VPS plans and prices for Ubuntu 24.04
  sumopod vps list              List your VPS instances
  sumopod vps wait [--timeout 15]
                                Wait for the newest VPS to be running with an IP
  sumopod vps get <id>          Show one VPS (the password stays in the dashboard)
  sumopod vps firewall <id>     List firewall rules for a VPS
  sumopod providers             List VPS providers and regions

Global:
  --json                        Machine-readable output

Auth comes from ~/.config/sumopod/session.json or the SUMOPOD_SESSION env var.
Creating, renewing, upgrading, or deleting a VPS is only in the dashboard.`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  const flags = parseFlags(args);
  const [cmd, sub, arg] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--[a-z-]+$/.test(args[i - 1]) && flags[args[i - 1].slice(2)] === a));
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return usage();
  if (cmd === 'login') return cmdLogin();

  const session = readSession();
  switch (cmd) {
    case 'whoami': return cmdWhoami(session);
    case 'providers': return cmdProviders(session);
    case 'plans': return cmdPlans(session, flags);
    case 'vps':
      if (sub === 'list') return cmdVpsList(session);
      if (sub === 'wait') return cmdVpsWait(session, flags);
      if (sub === 'get') return cmdVpsGet(session, arg);
      if (sub === 'firewall') return cmdVpsFirewall(session, arg);
      return die('usage: sumopod vps <list|wait|get|firewall>');
    default:
      return die(`unknown command: ${cmd}. Run: sumopod help`);
  }
}

main().catch((e) => die(e?.message || String(e)));
