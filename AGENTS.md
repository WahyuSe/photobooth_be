# PhotoBooth Backend — AGENTS.md

Panduan ini ditujukan untuk AI agent (seperti Antigravity / Gemini) yang bekerja di repository ini.
Baca seluruh dokumen ini sebelum membuat perubahan apa pun pada kode.

---

## ?? Gambaran Proyek

Backend Express.js + TypeScript untuk aplikasi **PhotoBooth Kiosk**.
Sistem ini mengelola:
- Template frame foto (desain, layout, koordinat slot foto)
- Sesi kiosk (antrean, status, heartbeat)
- Upload foto ke **Google Drive** (via Service Account atau Apps Script proxy)
- Pengiriman foto via **Email** (Nodemailer/SMTP)
- Konfigurasi event (kuota, durasi, GIF, Live Photo)
- UI Theme dinamis (warna, font, border radius)
- Ukuran canvas & cetak (CanvasSize presets)
- Gallery foto hasil sesi

Backend ini di-deploy ke **Vercel** (serverless) dan juga bisa dijalankan secara lokal.

---

## ??? Arsitektur & Struktur Direktori

```
backend/
+-- src/
¦   +-- index.ts              # Entry point Express app, setup CORS, routes, static files
¦   +-- prisma.ts             # Singleton Prisma Client
¦   +-- routes/               # Route handlers (satu file per domain)
¦   ¦   +-- admin.ts          # Admin auth, settings, event config, themes, canvas sizes
¦   ¦   +-- canvasSizes.ts    # CRUD canvas size presets
¦   ¦   +-- email.ts          # Kirim email foto, verifikasi SMTP
¦   ¦   +-- event.ts          # Konfigurasi event publik (baca saja)
¦   ¦   +-- gallery.ts        # Gallery foto sesi, akses via access token
¦   ¦   +-- sessions.ts       # CRUD sesi kiosk (pending, active, heartbeat, status)
¦   ¦   +-- templates.ts      # CRUD template frame foto
¦   ¦   +-- theme.ts          # Baca active UI theme
¦   ¦   +-- upload.ts         # Upload file lokal (Multer) & upload ke Google Drive
¦   +-- services/
¦       +-- emailService.ts   # Nodemailer transporter & send helper
¦       +-- googleDriveService.ts # Upload ke Google Drive (Service Account / Apps Script proxy)
+-- prisma/
¦   +-- schema.prisma         # Definisi semua model database
¦   +-- seed.ts               # Data seed awal (templates, themes, canvas sizes)
¦   +-- migrations/           # File migrasi Prisma
+-- uploads/                  # Direktori penyimpanan file overlay lokal (Multer)
+-- dist/                     # Output kompilasi TypeScript (jangan edit manual)
+-- .env                      # Environment variables (tidak di-commit)
+-- .env.example              # Template env vars
+-- vercel.json               # Konfigurasi deploy Vercel
+-- tsconfig.json             # Konfigurasi TypeScript
+-- nodemon.json              # Konfigurasi nodemon untuk dev
+-- package.json              # Dependencies & npm scripts
```

---

## ??? Database Schema (Prisma / PostgreSQL)

Model utama dalam `prisma/schema.prisma`:

| Model              | Fungsi                                                             |
|--------------------|--------------------------------------------------------------------|
| `Template`         | Template frame foto (layout, warna, slot foto, overlay image)     |
| `TemplateCategory` | Kategori template                                                  |
| `EventConfig`      | Konfigurasi event aktif (quota, durasi sesi, fitur GIF/LivePhoto)  |
| `Session`          | Sesi kiosk (status: PENDING/ACTIVE/FINISHED/CANCELLED, token akses)|
| `UITheme`          | Konfigurasi tema visual UI (warna, font, radius)                   |
| `CanvasSize`       | Preset ukuran canvas & cetak per layout type                       |

**Aturan Penting:**
- Selalu jalankan `npx prisma db push` atau buat migration setelah mengubah `schema.prisma`.
- Gunakan `npx prisma generate` setelah menginstal ulang dependencies.
- Jangan hapus kolom yang masih digunakan — buat migration yang additive terlebih dahulu.
- `Session.accessToken` adalah `@unique` — digunakan untuk akses gallery publik.

---

## ?? API Endpoints

### Admin (`/api/admin`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/login` | Login admin, returns token |
| GET | `/settings` | Baca `settings.json` (konfigurasi dinamis) |
| POST | `/settings` | Update `settings.json` |
| GET | `/event` | Baca konfigurasi event aktif |
| POST | `/event` | Buat/update event config |
| GET | `/themes` | Daftar semua UI theme |
| POST | `/themes` | Buat UI theme baru |
| PUT | `/themes/:id` | Update UI theme |
| DELETE | `/themes/:id` | Hapus UI theme |
| PUT | `/themes/:id/activate` | Aktifkan satu theme |
| GET | `/canvas-sizes` | Daftar canvas size presets (admin) |

### Templates (`/api/templates`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/` | Daftar semua template |
| GET | `/:id` | Detail satu template |
| POST | `/` | Buat template baru |
| PUT | `/:id` | Update template |
| DELETE | `/:id` | Hapus template |

### Sessions (`/api/sessions`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/create-pending` | Buat sesi antrean baru |
| GET | `/pending` | Ambil sesi pending terawal |
| POST | `/:id/status` | Update status sesi |
| POST | `/:id/heartbeat` | Kirim heartbeat dari kiosk |
| GET | `/history` | Riwayat sesi (admin) |

### Upload (`/api/upload`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/` | Upload file overlay lokal (Multer, field: `overlay`) |
| POST | `/google-drive` | Upload foto Base64 ke Google Drive |
| DELETE | `/:filename` | Hapus file overlay lokal |

### Email (`/api/email`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/send` | Kirim foto Base64 ke email pelanggan |
| GET | `/verify` | Verifikasi koneksi SMTP |

### Gallery (`/api/gallery`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/:sessionId` | Ambil data gallery (autentikasi via `accessToken` query param) |

### Event (`/api/event`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/` | Baca event config aktif (publik, untuk kiosk) |

### Theme (`/api/theme`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/active` | Ambil UI theme yang sedang aktif |

### Canvas Sizes (`/api/canvas-sizes`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/` | Daftar canvas size presets aktif (publik) |

---

## ?? Environment Variables

Semua env vars wajib ada di file `.env`. Lihat `.env.example` untuk template.

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `PORT` | ? | Port server (default: `4000`) |
| `FRONTEND_URL` | ? | URL frontend Next.js untuk CORS |
| `DATABASE_URL` | ? | Connection string PostgreSQL |
| `ADMIN_PASSWORD` | ? | Password login admin |
| `SMTP_HOST` | ? | Host SMTP (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | ? | Port SMTP (e.g., `587`) |
| `SMTP_SECURE` | ? | `true`/`false` untuk TLS |
| `SMTP_USER` | ? | Email akun SMTP |
| `SMTP_PASS` | ? | App password akun SMTP |
| `EMAIL_FROM` | ? | Display name + email pengirim |
| `GOOGLE_DRIVE_FOLDER_ID` | ? | ID folder Google Drive target |
| `GOOGLE_DRIVE_SCRIPT_URL` | ?? | URL Apps Script proxy (fallback jika bukan Service Account) |
| `GOOGLE_CREDENTIAL` | ? | Path ke `google-credentials.json`, JSON satu baris, atau base64 |

---

## ??? Conventions & Coding Rules

### TypeScript
- Semua kode menggunakan **TypeScript** (`strict: false` di `tsconfig.json`).
- Import menggunakan **CommonJS** (`"type": "commonjs"` di `package.json`).
- Gunakan `import X from '...'` bukan `require()` kecuali untuk modul yang tidak mendukung ESM.
- Tipe Prisma sudah di-generate — selalu gunakan tipe dari `@prisma/client`.

### Express Route Handlers
- Satu file route per domain resource (tidak boleh di-campur).
- Semua handler di dalam route file — tidak perlu `controller/` terpisah untuk project ini.
- Gunakan `async/await` dan tangkap error dengan `try/catch`, kirim response JSON dengan status code yang tepat.
- Format response error: `{ error: "pesan error" }`.
- Format response sukses: JSON objek/array yang relevan.

### Prisma Client
- Gunakan singleton dari `src/prisma.ts` — **jangan** instansiasi `PrismaClient` baru di luar file tersebut.
- Untuk query batch, gunakan `prisma.$transaction([...])`.

### File Upload (Multer)
- File overlay disimpan di direktori `uploads/` (lokal, bukan cloud).
- Endpoint `/api/upload` menggunakan Multer, field name: `overlay`.
- Nama file di-generate menggunakan `uuid` untuk menghindari collision.

### Google Drive Integration
- Gunakan `src/services/googleDriveService.ts` untuk semua operasi Google Drive.
- Mendukung dua mode: **Service Account** (production/Vercel) dan **Apps Script Proxy** (fallback untuk akun `@gmail.com`).
- `GOOGLE_CREDENTIAL` bisa berupa: path file JSON, JSON string satu baris, atau base64-encoded JSON.
- **Jangan** hardcode credential di kode — selalu baca dari env var.

### CORS
- Konfigurasi CORS di `src/index.ts` sudah fleksibel: mengizinkan localhost, `FRONTEND_URL`, dan semua subdomain `*.vercel.app`.
- Untuk menambah whitelist baru, edit blok CORS di `src/index.ts`.

### Autentikasi Admin
- Autentikasi menggunakan password sederhana (`ADMIN_PASSWORD` dari `.env`) yang di-compare di route `/api/admin/login`.
- Tidak ada JWT library — token dikembalikan sebagai string sederhana (atau di-set via cookie, tergantung implementasi frontend).
- **Jangan** tambah library auth kompleks tanpa diskusi terlebih dahulu.

### Settings Dinamis
- `settings.json` di root proyek digunakan untuk flag-flag konfigurasi runtime (seperti toggle fitur WhatsApp share).
- Baca/tulis via route `/api/admin/settings` — **jangan** akses file ini langsung dari route lain.

---

## ?? Cara Menjalankan

```bash
# Install dependencies
npm install

# Setup database
npx prisma db push

# Development (auto-reload dengan nodemon)
npm run dev

# Production build
npm run build
npm start
```

---

## ?? Testing & Verifikasi

Project ini belum memiliki automated test suite.
Untuk verifikasi manual setelah perubahan:

1. **Health check:** `GET http://localhost:4000/health` — harus return `{ status: "OK" }`
2. **Database:** Jalankan `node check_db.js` untuk memverifikasi koneksi.
3. **SMTP:** `GET /api/email/verify` untuk mengecek koneksi email.
4. **Prisma Studio:** `npx prisma studio` untuk inspeksi data langsung.

---

## ?? Hal yang Perlu Diperhatikan

1. **Jangan commit `.env` atau `google-credentials.json`** — keduanya ada di `.gitignore`.
2. **`dist/`** adalah output build — jangan edit file di dalamnya secara manual.
3. **`node_modules/`** — jangan modifikasi, selalu gunakan `npm install`.
4. Saat deploy ke **Vercel**: pastikan semua env vars sudah di-set di Vercel dashboard. `GOOGLE_CREDENTIAL` harus berformat JSON satu baris atau base64 (bukan path file).
5. **Request body limit** di-set ke `75mb` karena foto Base64 bisa sangat besar — jangan turunkan nilainya.
6. **Express v5** sudah digunakan (`"express": "^5.2.1"`) — beberapa API berbeda dari v4 (terutama async error handling yang kini native).
7. Kolom `Session.status` menggunakan string literal (`"PENDING"`, `"ACTIVE"`, `"FINISHED"`, `"CANCELLED"`) — bukan Prisma enum. Validasi di level aplikasi.

---

## ?? Key Dependencies

| Package | Versi | Kegunaan |
|---------|-------|---------|
| `express` | ^5.2.1 | HTTP server framework |
| `@prisma/client` | ^6.19.3 | Database ORM (PostgreSQL) |
| `prisma` | ^6.19.3 | Prisma CLI & schema tooling |
| `googleapis` | ^172.0.0 | Google Drive API (Service Account) |
| `nodemailer` | ^9.0.1 | Pengiriman email via SMTP |
| `multer` | ^2.1.1 | File upload middleware |
| `sharp` | ^0.34.5 | Pemrosesan gambar (resize, convert) |
| `uuid` | ^14.0.0 | Generate unique ID untuk nama file |
| `cors` | ^2.8.6 | CORS middleware |
| `dotenv` | ^17.4.2 | Load environment variables |
| `typescript` | ^6.0.3 | TypeScript compiler |
| `ts-node` | ^10.9.2 | Run TypeScript langsung (dev) |
| `nodemon` | ^3.1.14 | Auto-reload saat dev |
