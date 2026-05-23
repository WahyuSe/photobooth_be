# 💻 Express.js PhotoBooth Backend API

Direktori ini berisi kode server backend untuk aplikasi PhotoBooth. Backend dibangun menggunakan Express.js, TypeScript, Nodemailer, Prisma ORM (PostgreSQL), dan Google APIs.

---

## 🛠️ Langkah Instalasi

1. **Masuk ke Direktori:**
   ```bash
   cd backend
   ```

2. **Instal Dependensi:**
   ```bash
   npm install
   ```

3. **Buat File Environment Konfigurasi:**
   Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Konfigurasi Variabel Lingkungan (`.env`):**
   Buka file `.env` dan lengkapi konfigurasi berikut:
   * `PORT`: Port server (default: `4000`).
   * `FRONTEND_URL`: URL aplikasi Next.js Anda (default: `http://localhost:3000`).
   * `DATABASE_URL`: URL koneksi PostgreSQL Anda.
   * `ADMIN_PASSWORD`: Sandi masuk admin (default: `admin123`).
   * `SMTP_USER` & `SMTP_PASS`: Kredensial SMTP Gmail/Email Anda (lihat panduan SMTP Gmail di README utama).
   * `GOOGLE_DRIVE_FOLDER_ID`: ID Folder Google Drive target penyimpanan foto.
   * `GOOGLE_DRIVE_SCRIPT_URL`: URL Web App Google Apps Script proxy (jika menggunakan akun gratis `@gmail.com`).

5. **Sinkronisasi Skema Database (Prisma):**
   Jalankan perintah ini untuk membuat tabel otomatis di database PostgreSQL Anda:
   ```bash
   npx prisma db push
   ```

---

## 🚀 Perintah Menjalankan Server

- **Mode Pengembangan (Dev):**
  Menjalankan server dengan Nodemon untuk auto-reload saat ada perubahan kode.
  ```bash
  npm run dev
  ```

- **Mode Produksi (Build & Start):**
  Kompilasi kode TypeScript ke JavaScript (`dist`) lalu jalankan server produksi.
  ```bash
  npm run build
  npm start
  ```

---

## 🔌 API Endpoints

### Autentikasi Admin
- `POST /api/admin/login` - Melakukan login admin dan mengembalikan token.
- `GET /api/admin/settings` - Membaca konfigurasi dinamis sistem (`settings.json`).
- `POST /api/admin/settings` - Memperbarui konfigurasi sistem dinamis (seperti toggle share WhatsApp).

### Email
- `POST /api/email/send` - Mengirim foto hasil photobooth berformat Base64 ke email pelanggan.
- `GET /api/email/verify` - Memeriksa status koneksi ke SMTP Server.

### Template Frame Foto
- `GET /api/templates` - Mendapatkan daftar semua template.
- `GET /api/templates/:id` - Mendapatkan detail satu template.
- `POST /api/templates` - Membuat template baru (Admin).
- `PUT /api/templates/:id` - Memperbarui template / koordinat tata letak (Admin).
- `DELETE /api/templates/:id` - Menghapus template (Admin).

### Sesi Kiosk (Sessions)
- `POST /api/sessions/create-pending` - Membuat sesi antrean baru (Admin).
- `GET /api/sessions/pending` - Mengambil antrean sesi terawal untuk dimulai di Kiosk.
- `POST /api/sessions/:id/status` - Mengubah status sesi (`ACTIVE`, `FINISHED`, `CANCELLED`).
- `POST /api/sessions/:id/heartbeat` - Mengirim sinyal detak jantung berkala dari Kiosk ke server.
- `GET /api/sessions/history` - Melihat riwayat sesi terbaru (Admin).

### Google Drive & File Upload
- `POST /api/upload` - Mengunggah gambar overlay transparan lokal (Multer).
- `POST /api/upload/google-drive` - Mengunggah foto Base64 final hasil edit ke Google Drive (via Apps Script proxy / Service Account).
- `DELETE /api/upload/:filename` - Menghapus file lokal hasil unggahan.
