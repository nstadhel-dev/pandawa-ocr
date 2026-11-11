# 🦅 PANDAWA OCR — Panduan Instalasi Lengkap

> **Versi Deploy** — D1 sebagai penyimpanan utama, LocalStorage sebagai cache cepat.
> **Tanpa `worker.js` terpisah** — Backend memakai **Cloudflare Pages Functions** (folder `functions/`), otomatis ikut ter-deploy saat folder diupload ke Pages.
> **Ringan & mudah** — Cukup upload 1 folder, tidak perlu install apa-apa.

---

## 📁 Isi Folder Ini

```
pandawa_deploy_v2/
├── index.html          ← Halaman Utama (OCR + Simpan)
├── arsip.html          ← Arsip Nota
├── kelola-user.html    ← Kelola User + Backup/Restore/Storage
├── wrangler.toml       ← Config D1 (isi Database ID di sini)
├── _headers            ← Security Headers (otomatis dibaca Pages)
├── _redirects          ← URL bersih (/arsip, /kelola-user)
├── functions/
│   ├── _lib.js         ← Helper bersama (auth, hash, validasi) — TIDAK di-routing
│   └── api/
│       ├── auth.js     ← Login / Logout / Cek sesi (POST /api/auth?action=login)
│       ├── users.js    ← CRUD User (Admin saja)
│       ├── nota.js     ← CRUD Nota (D1)
│       ├── settings.js ← Simpan API Key (Admin saja, key TIDAK pernah ke browser)
│       ├── gemini.js   ← Proxy Gemini (key tetap di server, tidak bisa dicuri)
│       └── storage.js  ← Info storage D1 (jumlah nota, estimasi ukuran, sisa)
└── PANDUAN_INSTALASI.md ← File ini
```

### File yang TIDAK ada (sengaja)
- ❌ `worker.js` — **Tidak dipakai.** Backend adalah Pages Functions (`functions/`), bukan Worker terpisah. Pages otomatis deploy `functions/` saat folder diupload.
- ❌ `package.json` / `node_modules` — Tidak perlu. Semua file HTML + Functions murni (tanpa build).

---

## ✅ Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Akun Cloudflare | Gratis di [dash.cloudflare.com](https://dash.cloudflare.com) → Sign Up |
| Browser modern | Chrome / Edge / Firefox terbaru (untuk kamera + OCR) |
| Gemini API Key | Gratis di [Google AI Studio](https://aistudio.google.com) → Get API Key |
| Folder ini | `pandawa_deploy_v2/` (yang sedang kamu baca) |

> **Biaya:** Semua gratis di paket Free Cloudflare (D1 Free ±5 GB, Pages Free unlimited request wajar).

---

## 🚀 Instalasi — 5 Langkah (10–15 menit)

### LANGKAH 1 — Buat Database D1 (2 menit)

1. Login ke [dash.cloudflare.com](https://dash.cloudflare.com).
2. Menu kiri → **Workers & Pages** → tab **D1** (atau ketik "D1" di search).
3. Klik **Create database**.
4. Nama database: `pandawa_d1` (harus persis ini, karena `wrangler.toml` pakai nama ini).
5. Klik **Create**.
6. Di halaman database, **salin Database ID** (bentuk UUID, misal `xxxxxxxx-xxxx-...`). Simpan — dipakai di Langkah 3.

> **Catatan:** Tabel (`nota`, `users`, `sessions`, `settings`, `gabungan`) **dibuat otomatis** saat pertama kali API dipanggil. Kamu tidak perlu buat tabel manual.

### LANGKAH 2 — Upload Folder ke Cloudflare Pages (3 menit)

**Cara A — Drag & Drop (paling mudah, tanpa Git):**

1. Di Dashboard Cloudflare → menu kiri → **Workers & Pages** → **Create application** → tab **Pages** → **Upload assets**.
2. Nama project: `pandawa-ocr` (atau bebas, misal `pandawa-ocr-saya`).
3. Klik **Select from your computer** / drag & drop → pilih **seluruh isi folder `pandawa_deploy_v2/`** (bukan folder-nya, tapi isinya: `index.html`, `arsip.html`, dst).
   - ⚠️ **Penting:** Pastikan file `index.html` ada di root (bukan di dalam subfolder). Jika kamu upload folder-nya, Pages akan anggap `pandawa_deploy_v2/index.html` → URL jadi `.../pandawa_deploy_v2/` — salah. Upload **isinya**.
4. Klik **Deploy site**.
5. Tunggu ±1 menit → dapat URL, misal `https://pandawa-ocr.pages.dev`.

**Cara B — Via Git (untuk update mudah ke depan):**

1. Buat repo GitHub/GitLab, upload isi folder ini ke repo.
2. Di Cloudflare → Workers & Pages → Create → Pages → **Import an existing Git repository** → pilih repo.
3. Framework preset: **None** (atau "Static"). Build command: **(kosongkan)**. Build output: **`.`** (titik).
4. Deploy. Setiap `git push` akan auto-deploy.

### LANGKAH 3 — Hubungkan D1 ke Pages (Binding) — WAJIB (2 menit)

> ⚠️ **Kalau langkah ini dilewati, aplikasi jalan tapi data TIDAK tersimpan ke D1** (hanya LocalStorage + error "D1 tidak terjangkau").

1. Di Dashboard → Workers & Pages → klik project `pandawa-ocr` (yang baru dibuat).
2. Tab **Settings** → **Functions** → **D1 database bindings** → **Add binding**.
3. Isi:
   - **Variable name:** `DB` (harus persis `DB`, huruf besar — kode Functions pakai `env.DB`)
   - **D1 database:** pilih `pandawa_d1` (yang dibuat di Langkah 1)
4. Klik **Add binding** / **Save**.
5. Tab **Deployments** → klik **⋯** di deployment terbaru → **Retry deployment** (agar binding aktif).

**Alternatif (via `wrangler.toml`):** Buka file `wrangler.toml` di folder ini, ganti `GANTI_DENGAN_ID_D1_KAMU` dengan Database ID dari Langkah 1, lalu upload ulang. Tapi binding via Dashboard (cara di atas) lebih mudah dan tidak perlu edit file.

### LANGKAH 4 — (Opsional) Set API Key via Environment Variable

> **Tidak wajib.** API Key bisa diset dari dalam aplikasi (Kelola User → Set Key, Admin saja). Cara ini hanya alternatif jika kamu mau key disimpan di env, bukan D1.

1. Di project Pages → **Settings** → **Environment variables** → **Add variable**.
2. Nama: `GEMINI_API_KEY`, Nilai: `AIza...` (key dari Google AI Studio).
3. **Production** → Save → Redeploy.

> Jika `GEMINI_API_KEY` diset di env, aplikasi pakai env (prioritas). Jika tidak, aplikasi pakai key dari D1 (yang diset via Kelola User).

### LANGKAH 5 — Uji Aplikasi (3 menit)

1. Buka URL Pages kamu, misal `https://pandawa-ocr.pages.dev`.
2. **Preload** PANDAWA GROUP muncul ±1,6 detik → halaman login.
3. Login default: **Username** `admin`, **Password** `12345`.
   - ⚠️ **Segera ganti password** via Kelola User → Edit admin → password baru (lihat "Keamanan" di bawah).
4. **Set Gemini API Key** (Admin saja):
   - Klik **Kelola User** (header) → section **Set Gemini API Key** (atau di Halaman Utama → tombol Set Key).
   - Tempel key `AIza...` → Simpan. Key tersimpan di D1, **tidak pernah tampil di browser**.
5. **Uji OCR:**
   - Di Halaman Utama → foto nota (kamera / upload) → **Proses** → hasil muncul.
   - Klik **Simpan ke D1** → toast "Sync ke D1 BERHASIL!".
6. **Uji Arsip:**
   - Klik **Arsip Nota** → nota yang baru disimpan tampil.
7. **Uji Storage:**
   - Klik **Kelola User** → panel **Storage Database** → LocalStorage + D1 tampil (jumlah nota, estimasi ukuran, sisa).

> ✅ **Jika semua langkah di atas jalan, instalasi BERHASIL.**

---

## 📖 Cara Pakai (Harian)

| Halaman | Fungsi |
|---|---|
| **Halaman Utama** (`/`) | Foto nota → OCR (Gemini) → edit tabel → Simpan ke D1 |
| **Arsip** (`/arsip`) | Lihat semua nota, cari, filter, detail, print, export PDF/Excel, muat ke OCR, hapus |
| **Kelola User** (`/kelola-user`) | Tambah/edit/hapus user, set API Key, lihat Storage, Backup/Restore, Hapus LocalStorage |

### Role
- **Admin:** Semua (OCR, Arsip, Kelola User, Set Key, Backup/Restore, Hapus).
- **User:** OCR + Arsip saja. **Tidak bisa** buka Kelola User (akan tampil "Akses Ditolak").

### Backup & Restore (di Kelola User)
- **Backup:** Klik "Download Backup (.json)" → simpan file `PANDAWA_BACKUP_*.json` di tempat aman (Google Drive / flashdisk).
- **Restore:** Pilih file backup → cek preview → Restore → halaman reload, data kembali.
- **Jadwal disarankan:** Backup tiap minggu, atau sebelum hapus data besar.

---

## 💾 Cara Kerja Penyimpanan (D1 + Cache)

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (cepat, untuk tampil)                          │
│  LocalStorage = CACHE (tampil instan, <50ms)            │
│  - Arsip, User, Sesi, Antrian                           │
└──────────────────▲───────────────────────┬──────────────┘
                   │ Sync (saat load/save)  │ Sync
                   ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│  CLOUDFLARE D1 (sumber utama, permanen)                │
│  Tabel: nota, users, sessions, settings, gabungan       │
│  Batas: ±5 GB (Free)                                    │
└─────────────────────────────────────────────────────────┘
```

| Aksi | Yang terjadi |
|---|---|
| **Buka halaman** | Tampil dari LocalStorage dulu (cepat) → lalu sync dari D1 (fresh) → LocalStorage diperbarui |
| **Simpan nota** | Simpan ke D1 dulu (via `/api/nota`) → lalu update cache LocalStorage. Jika D1 gagal (offline), simpan ke LocalStorage + antrian, auto-retry saat online |
| **Login** | Cek ke D1 (via `/api/auth`) → dapat token (24 jam) → token di `sessionStorage` (hilang saat tab ditutup) |
| **OCR (Gemini)** | Browser kirim gambar + prompt ke `/api/gemini` → server panggil Gemini pakai key dari D1 → kembalikan hasil. **Key tidak pernah ke browser** |
| **Set API Key** | Admin kirim key ke `/api/settings` → tersimpan di D1. Browser **tidak pernah** baca isi key (hanya status: ada/tidak) |

### Kenapa tidak 100% D1 (tanpa LocalStorage sama sekali)?
- **Kecepatan:** Tampil dari LocalStorage <50ms. Tampil dari D1 butuh 200–500ms (network). Cache bikin aplikasi terasa instan.
- **Offline:** Jika internet putus / D1 down, aplikasi tetap bisa buka & lihat data terakhir (dari cache), lalu sync saat online lagi.
- **Keamanan:** LocalStorage hanya cache. Sumber kebenaran adalah D1. Jika cache dihapus, data tetap aman di D1 (sync ulang saat login).

### Storage D1 — Cara Baca Panel di Kelola User
- **Jumlah nota di D1:** Dari `GET /api/nota` (isi tabel).
- **Estimasi ukuran D1:** Jumlah byte data `nota` (JSON) + metadata. Ini estimasi dari isi tabel — ukuran disk sebenarnya dihitung Cloudflare.
- **Sisa:** `5 GB − estimasi terpakai`. Jika mendekati 5 GB, hapus nota lama (Arsip → hapus) atau backup lalu hapus.
- **Antrian sync:** Nota yang belum terkirim ke D1 (karena offline). Akan auto-retry.

---

## 🔒 Keamanan (Yang Sudah Diterapkan)

| Ancaman | Penanganan |
|---|---|
| **SQL Injection** | Semua query D1 pakai **parameterized** (`.bind(...)`). **Tidak ada** string concat ke SQL. Input dibersihkan (`cleanStr`, hapus karakter kontrol). Username validasi regex `^[a-zA-Z0-9_.-]{3,30}$`. |
| **API Key dicuri** | Key **tidak pernah** dikirim ke browser. Disimpan di D1 (`settings`), hanya server yang baca. OCR via proxy `/api/gemini` — browser kirim gambar, server yang panggil Gemini. **Cek:** Buka DevTools → Network → tidak ada `AIza...` di request manapun. |
| **XSS (script injection)** | Input dibersihkan (hapus karakter kontrol). Output di-escape (`esc()` di Kelola User). Content-Security-Policy di `_headers`. |
| **CSRF** | API pakai `Authorization: Bearer <token>` (bukan cookie). Token di `sessionStorage` (tidak ikut terkirim otomatis). CORS hanya same-origin / `*.pages.dev`. |
| **Brute force login** | Password di-hash **SHA-256 + salt** (bukan plaintext). Token 32-byte random, kadaluarsa 24 jam. Login gagal tidak beri tahu "username salah" vs "password salah" (pesan sama). |
| **Akses sembarangan** | Semua endpoint `/api/*` (kecuali login) wajib token. Endpoint Admin (users, settings) wajib role `admin`. Cek admin terakhir (tidak bisa hapus/ubah admin terakhir jadi user). Tidak bisa hapus akun sendiri. |
| **Klik kanan / Copas** | Klik kanan (context menu) dimatikan. Copy (Ctrl+C) & Cut (Ctrl+X) dimatikan. View Source (Ctrl+U) & DevTools shortcut (F12, Ctrl+Shift+I) dimatikan (deterrent). **Paste di input TETAP diizinkan** agar API Key bisa ditempel. |
| **Clickjacking** | `X-Frame-Options: DENY` di `_headers` (halaman tidak bisa di-embed di iframe situs lain). |
| **MIME sniffing** | `X-Content-Type-Options: nosniff`. |
| **HTTPS** | Cloudflare Pages otomatis HTTPS + `Strict-Transport-Security` (HSTS). |

### ⚠️ Batasan Keamanan (Jujur)
- **Disable klik kanan / copas / DevTools adalah deterrent, bukan benteng.** User yang paham teknis masih bisa buka DevTools via menu browser / `view-source:` / curl. **Yang benar-benar aman adalah:** key tidak pernah ke browser (sudah), password di-hash (sudah), SQL parameterized (sudah), token auth (sudah). Jangan andalkan "disable klik kanan" sebagai satu-satunya pertahanan.
- **Jangan share URL Pages + password admin ke sembarang orang.** Siapa pun yang login sebagai admin bisa lihat semua data.
- **Ganti password default `12345` segera.** Jika tidak, siapa pun yang tahu URL bisa login admin.
- **Backup rutin.** D1 bukan backup otomatis. Jika database D1 dihapus di Dashboard, data hilang (kecuali ada file backup JSON).

---

## 🛠️ Troubleshooting — Error & Solusi

| Gejala / Error | Penyebab | Solusi |
|---|---|---|
| **"D1 tidak terjangkau" / "Failed to fetch"** | Binding D1 belum dipasang, atau belum redeploy setelah binding | Ulangi **Langkah 3** (Settings → Functions → D1 binding → `DB` → `pandawa_d1`) → **Retry deployment**. Tunggu 1 menit, refresh. |
| **Login gagal padahal `admin` / `12345`** | Database D1 baru, seed admin belum jalan, atau password sudah diganti | 1) Cek binding D1 (di atas). 2) Buka DevTools → Console → lihat error. 3) Jika password lupa, hapus database D1 di Dashboard → buat baru `pandawa_d1` → binding ulang → redeploy → login `admin` / `12345` lagi. |
| **"Gemini API Key belum diset"** | Key belum disimpan ke D1 | Login sebagai Admin → Kelola User → Set Key → tempel `AIza...` → Simpan. Atau set env `GEMINI_API_KEY` (Langkah 4). |
| **"Gemini gagal (semua key)" / 429 / quota** | Quota Gemini habis, atau key salah | 1) Cek key di [AI Studio](https://aistudio.google.com) (masih aktif?). 2) Buat key baru → Set Key lagi. 3) Tunggu 1 menit (quota reset per menit). 4) Jika pakai Free tier, batas ~15 request/menit — jangan spam Proses. |
| **OCR hasil kosong / "Response kosong"** | Foto buram / gelap, atau model tidak kembalikan JSON | 1) Foto ulang (terang, fokus, nota lurus). 2) Coba format lain (STANDART / OTOMATIS). 3) Cek Console untuk pesan error detail. |
| **Halaman putih / blank setelah upload** | File `index.html` tidak di root, atau upload folder-nya (bukan isinya) | Upload **isi** folder, bukan folder-nya. Pastikan di Pages → Files ada `index.html` di root. |
| **"Unauthorized - login dulu" saat Simpan** | Token habis (24 jam) atau belum login D1 | Logout → login lagi. Token baru 24 jam. |
| **"Akses Ditolak" di Kelola User** | Login sebagai `user` (bukan `admin`) | Kelola User hanya Admin. Login sebagai admin. |
| **Data hilang setelah hapus LocalStorage** | Cache dihapus, tapi D1 seharusnya sync ulang | Login lagi → sync D1 otomatis jalan → data kembali. Jika tidak kembali, cek binding D1 (Langkah 3) + cek di Arsip (apakah nota ada di D1). Jika D1 juga kosong, restore dari file backup JSON. |
| **"Hapus SEMUA" terklik, semua user hilang** | Tombol Hapus SEMUA di Kelola User menghapus semua LocalStorage termasuk user | Login lagi → D1 akan sync user dari server (jika user ada di D1). Jika D1 juga kosong, login default `admin` / `12345` (seed otomatis). |
| **Foto tidak bisa diambil (kamera)** | Izin kamera ditolak, atau buka via `http` (bukan `https`) | Cloudflare Pages otomatis HTTPS. Izinkan kamera saat browser minta. Jika masih gagal, pakai **Upload foto** (pilih dari galeri) sebagai alternatif. |
| **Build gagal / "Failed" di Deployments** | `wrangler.toml` salah, atau file `functions/` error | 1) Cek `wrangler.toml` — `database_id` boleh `GANTI...` (tidak dipakai jika binding via Dashboard). 2) Cek tab **Functions** → **Logs** untuk error detail. 3) Upload ulang folder (pastikan file `functions/` lengkap). |
| **CORS error di Console** | Buka file via `file://` (bukan via Pages) | **Jangan buka file langsung** (double-click HTML). Buka via URL Pages (`https://...pages.dev`). API D1 hanya jalan via Pages (butuh Functions + binding). |
| **"Cannot read properties of null" di Console** | Elemen HTML tidak ketemu (biasanya karena file tidak lengkap) | Upload ulang **seluruh** folder (jangan hanya 1 file). Pastikan 3 HTML + `functions/` lengkap. |

### Cara Lihat Log (untuk debug)
1. Dashboard → Workers & Pages → project `pandawa-ocr` → tab **Functions** → **Logs** (real-time).
2. Di browser → **F12** → tab **Console** (pesan error) + **Network** (request `/api/*` gagal?).
3. Jika error tidak jelas, screenshot Console + Network, lalu cek tabel di atas.

---

## 🔄 Update Aplikasi Ke Depan

1. Edit file di folder ini (di komputer).
2. **Cara A (Drag & Drop):** Upload ulang isi folder ke Pages (Deployments → Upload assets / buat deployment baru).
3. **Cara B (Git):** `git add .` → `git commit` → `git push` → auto-deploy.
4. **Jangan ubah** `database_id` di `wrangler.toml` jika binding sudah via Dashboard (binding Dashboard yang dipakai).
5. **Backup dulu** sebelum update besar (Kelola User → Download Backup).

---

## ❓ FAQ

**Q: Apakah bisa dipakai tanpa D1 (hanya LocalStorage)?**
A: Bisa. Jika binding D1 belum dipasang, aplikasi tetap jalan pakai LocalStorage (mode offline). Tapi data hanya di browser itu saja, tidak tersinkron antar perangkat. Pasang D1 agar data tersimpan permanen & bisa dibuka dari HP/laptop lain.

**Q: Apakah data di D1 aman jika saya hapus cache browser?**
A: Ya. Cache LocalStorage hanya salinan. Data asli di D1. Login lagi → sync ulang.

**Q: Berapa nota yang bisa disimpan?**
A: D1 Free ±5 GB. 1 nota (tanpa foto) ~2–10 KB. 1 nota + foto thumbnail ~50–150 KB. Jadi muat **puluhan ribu nota**. Panel Storage di Kelola User menampilkan estimasi & sisa.

**Q: Bisa ganti nama domain (`pandawa-ocr.pages.dev` → domain sendiri)?**
A: Bisa. Di Pages → **Custom domains** → tambah domain kamu (misal `ocr.pandawa.com`) → ikuti DNS yang diminta Cloudflare. Gratis.

**Q: Apakah API Key aman jika saya share URL Pages ke orang lain?**
A: Key aman (tidak pernah ke browser). Tapi **jangan share password admin**. Orang yang login admin bisa lihat semua data & ganti key.

**Q: Saya tidak mau pakai `worker.js`. Apakah folder ini pakai worker.js?**
A: **Tidak.** Folder ini pakai **Pages Functions** (`functions/`). Ini BUKAN worker.js terpisah — Functions adalah bagian dari folder Pages, otomatis ter-deploy saat folder diupload. Kamu tidak perlu buka Workers dashboard / deploy worker manual.

**Q: Kenapa klik kanan masih bisa di beberapa browser?**
A: Disable klik kanan adalah deterrent (penghalang ringan). Beberapa browser / ekstensi bisa bypass. Yang penting key & data sudah aman di server (lihat "Keamanan" di atas).

---

## 📞 Checklist Sebelum Go-Live

- [ ] D1 dibuat (`pandawa_d1`) + binding `DB` terpasang + redeploy
- [ ] Login `admin` / `12345` berhasil
- [ ] Password admin diganti (bukan `12345` lagi)
- [ ] Gemini API Key diset (Admin → Kelola User → Set Key)
- [ ] Uji OCR 1 nota → Simpan → muncul di Arsip
- [ ] Uji Kelola User → Storage tampil (LocalStorage + D1)
- [ ] Backup pertama didownload (`PANDAWA_BACKUP_*.json`) → simpan di tempat aman
- [ ] Buat user `user` (non-admin) untuk pemakaian harian (jangan pakai admin untuk OCR harian)

---

*PANDAWA OCR — Deploy v2 (D1 + Security). Dibuat: November 2026.*
