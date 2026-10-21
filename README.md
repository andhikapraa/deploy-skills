# deploy-skills

Agent skills buat deploy versi pertama MVP kamu. Kamu cukup bilang "deploy app ini", lalu agent (Claude Code, Antigravity, Cursor, Codex, dan lainnya) yang milih platform, ngecek kesiapan, dan jalanin perintahnya.

| Skill | Gunanya |
|---|---|
| `deploy-router` | Baca project, pilih Cloudflare atau Dokploy, cek build, `.env`, dan secret |
| `cloudflare-deploy` | Deploy gratis ke Cloudflare Workers pakai CLI `cf`, dapat URL `*.workers.dev` dengan HTTPS |
| `sumopod-dokploy-setup` | Siapin VPS SumoPod dan install Dokploy |
| `dokploy-deploy` | Deploy repo GitHub ke Dokploy, plus database dan domain |

## Install

Butuh Node.js 22.18 atau lebih baru. Jalankan di folder project kamu:

```bash
# Claude Code
npx skills add andhikapraa/deploy-skills -a claude-code

# Antigravity
npx skills add andhikapraa/deploy-skills -a antigravity

# Dua-duanya sekaligus
npx skills add andhikapraa/deploy-skills -a claude-code -a antigravity
```

Install di level project (tanpa `-g`). Setiap mulai, skill-nya otomatis jalanin `npx skills update -y` buat narik versi terbaru dari repo ini. Install global juga bisa, tapi pengecekan update-nya lewat API GitHub yang dibatasi 60 request per jam per IP, jadi gampang mentok kalau banyak orang pakai Wi-Fi yang sama.

## Pakai

Buka agent di folder project, lalu ketik:

> Deploy app ini dong. Pakai skill deploy-router.

Agent bakal nanya dulu sebelum ngelakuin hal yang kelihatan publik, misalnya deploy pertama.

Belum punya akun Cloudflare? Agent bisa deploy pakai akun sementara. Kamu tinggal buka link claim yang dikasih dalam 60 menit biar app-nya nggak dihapus.

## Pilih jalur

```text
App kamu butuh server yang jalan terus?
├─ Nggak (HTML, React/Vite SPA, Astro statis)   → Cloudflare (gratis)
├─ Dikit (API kecil, SSR ringan)                → Cloudflare Workers (gratis)
└─ Iya (Express, Laravel, Python, Postgres)     → VPS SumoPod + Dokploy
```

## Batas yang perlu kamu tahu

**Cloudflare Workers free**
- Request ke file statis gratis tanpa batas.
- Kode server: 100.000 request per hari dan 10 ms CPU per request.
- Memori 128 MB, dan nggak bisa jalanin proses yang nyala terus.

**SumoPod VPS + Dokploy**
- Dokploy minimal butuh 2 GB RAM dan 30 GB disk. Paket 2 vCPU / 2 GB / 40 GB udah cukup.
- Di provider Tencent, kuota egress bulanan itu batas keras. Kalau habis, VPS mati sampai bulan depan.
- User default Ubuntu Tencent itu `ubuntu`, bukan `root`.
- Port 22, 80, 443, dan 3000 harus kebuka di firewall SumoPod.
- Domain gratis `traefik.me` dari Dokploy cuma HTTP. Buat HTTPS, pakai domain sendiri.

## Keamanan

- Jangan pernah paste API key atau password ke chat agent.
- API key Dokploy disimpan pakai `npx -y dokploy-kit@latest login --url http://IP:3000`, dijalanin di jendela terminal terpisah (bukan lewat agent). Key-nya diketik tersembunyi dan disimpan ke `~/.config/dokploy/config.json`, terus semua agent bisa baca dari situ.
- Variabel `VITE_*`, `NEXT_PUBLIC_*`, dan `PUBLIC_*` bakal kelihatan di browser semua pengunjung. Jangan taruh secret di situ.
- Setelah install Dokploy, langsung buka panelnya dan bikin akun admin. Sebelum itu, siapa pun yang nemu URL-nya bisa ngambil alih server kamu.

## Lisensi

MIT
