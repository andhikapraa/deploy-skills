# sumopod-kit

CLI baca-saja buat info VPS SumoPod. Login pakai sesi dari browser, berlaku sekitar 1 jam.

Butuh Node.js 22 atau lebih baru. Tanpa dependency.

## Pakai

Script ini ikut ke-install bareng skill `sumopod-dokploy-setup`, di folder `scripts/`:

```bash
node .agents/skills/sumopod-dokploy-setup/scripts/sumopod.mjs help     # install di level project
```

Di bawah, `sumopod` artinya `node <folder skill>/scripts/sumopod.mjs`.

## Login

SumoPod nggak bisa login langsung dari terminal: login email minta captcha, dan login Google cuma bisa balik ke `sumopod.com`. Jadi sesinya diambil dari browser.

1. Login ke [sumopod.com](https://sumopod.com) di browser.
2. Buka DevTools (F12, atau Cmd+Opt+I di Mac), pilih tab **Console**, terus jalanin:
   ```js
   copy(localStorage.getItem("sumopod-auth"))
   ```
3. Di terminal, jalanin `sumopod login`, tempel hasilnya, terus tekan Enter.

Sesi disimpan di `~/.config/sumopod/session.json` (cuma kebaca sama kamu). Token di dalamnya di-refresh otomatis, tapi SumoPod mutus sesinya sekitar 1 jam setelah kamu login di browser, walaupun terus dipakai. Hasil ukur: sesi ditolak di menit ke-66 padahal di-refresh tiap 10 menit. Kalau muncul "token refresh failed", login ulang di browser terus ulangi langkah di atas.

Ambil sesinya pas mau dipakai, jangan dari jauh-jauh sebelumnya. Waktu 1 jam itu dihitung dari login di browser, bukan dari `sumopod login`.

Sesi ini sama kuatnya dengan login dashboard. Jangan tempel ke chat, jangan commit ke repo, dan jangan dibagi ke orang lain.

## Perintah

| Perintah | Gunanya |
|---|---|
| `sumopod whoami` | Akun dan saldo |
| `sumopod providers` | Provider VPS dan region yang tersedia |
| `sumopod plans [--region jakarta] [--provider tencent]` | Paket dan harga buat Ubuntu 24.04, plus tanda paket yang cukup buat Dokploy |
| `sumopod vps list` | Daftar VPS: nama, status, IP, username, spesifikasi |
| `sumopod vps wait [--timeout 15]` | Nunggu VPS terbaru jalan dan dapat IP, abis itu nampilin `user@ip` |
| `sumopod vps get <id>` | Detail satu VPS, termasuk pemakaian bandwidth |
| `sumopod vps firewall <id>` | Aturan firewall VPS |

Tambahin `--json` buat output yang bisa dibaca script atau agent.

## Yang sengaja nggak ada

Beli, perpanjang, upgrade, reinstall, dan reset VPS cuma bisa lewat dashboard. Aksi itu makan saldo atau ngehapus data, dan bikin VPS butuh captcha dari browser.

Password VPS nggak pernah ditampilin. Ambilnya dari tab Access di dashboard.

## Catatan

Kit ini pakai API internal dashboard SumoPod, bukan API publik, dan dibikin dengan izin SumoPod. API itu bisa berubah kapan aja. Kalau ada perintah yang tiba-tiba error, cek dulu di dashboard.
