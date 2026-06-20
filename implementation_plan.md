# Perubahan Flow Photobooth & Sistem Sesi Event

Dokumen ini adalah rancangan teknis (Implementation Plan) untuk fitur Event/Sesi Kiosk, Limitasi Quota, Timer Per Halaman, dan Kategori Template sesuai dengan permintaan Anda.

## User Review Required
> [!IMPORTANT]
> Harap periksa struktur database (`Prisma Schema`) dan *Flow* baru di bawah ini. Jika ada bagian yang kurang sesuai dengan yang Anda inginkan (misalnya nama tabel atau skenario retake), beri tahu saya agar bisa disesuaikan sebelum mulai dikerjakan.

> [!NOTE]
> Terlampir pembaruan dokumen berdasarkan *feedback* Anda:
> 1. Kuota sesi akan berkurang **hanya saat user menyelesaikan pemotretan (Selesai/Cetak)**.
> 2. Relasi template dan kategori diatur sebagai *One-to-Many* (1 Kategori punya banyak Template).
> 3. Halaman pemilihan template (Page 3) **hanya akan menampilkan template yang sesuai dengan grid yang dipilih di Page 1** (misal: Pilih 2x3, maka hanya template ber-layout 2x3 yang akan muncul).

---

## 1. Perubahan Skema Database (Backend Prisma)

Kita akan menambahkan tabel baru untuk konfigurasi Event/Sesi Global dan Kategori Template, serta memperbarui tabel yang sudah ada.

### A. Tabel Baru: `EventConfig`
Tabel ini menyimpan konfigurasi utama mesin photobooth saat dinyalakan dalam sebuah event.
```prisma
model EventConfig {
  id                  String   @id @default(cuid())
  eventName           String   @default("My Event")
  
  // Waktu aktif event
  startDate           DateTime
  endDate             DateTime
  
  // Kuota penggunaan
  quota               Int      @default(0) // 0 berarti unlimited
  usedQuota           Int      @default(0)

  // Durasi (dalam detik)
  userSessionDuration Int      @default(300) // Batas waktu maksimal per user
  page1Duration       Int      @default(30)  // Waktu pilih grid (Page 1)
  page2Duration       Int      @default(180) // Waktu sesi foto (Page 2)
  page3Duration       Int      @default(60)  // Waktu pilih template & cetak (Page 3)
  photoCountdown      Int      @default(5)   // Hitung mundur tiap jepretan kamera
  
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### B. Tabel Baru: `TemplateCategory`
```prisma
model TemplateCategory {
  id          String     @id @default(cuid())
  name        String     // Contoh: "Wedding", "Birthday", "Corporate"
  description String?
  templates   Template[] // Relasi ke Template
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

### C. Modifikasi `Template`
Menambahkan relasi ke `TemplateCategory`.
```diff
 model Template {
   id              String   @id @default(cuid())
   name            String
   description     String
   layout          String
   photoCount      Int
+  categoryId      String?
+  category        TemplateCategory? @relation(fields: [categoryId], references: [id])
   // ... field lainnya tetap sama
 }
```

### D. Modifikasi `Session` (Sesi User Individual)
Sesi tidak lagi dibuat manual oleh Admin per-orang, melainkan terbuat otomatis saat user klik "Mulai" di layar Kiosk.
```diff
 model Session {
   id          String    @id @default(uuid())
-  sessionCode String?   @unique
+  gridType    String?   // '2x3' atau '2x4'
   startTime   DateTime  @default(now())
   expiresAt   DateTime
   // ... field lainnya tetap sama
 }
```

---

## 2. Rangkaian Flow API Backend (BE)

### 1. `GET /api/event/config`
API baru yang akan dipanggil oleh *Frontend* di halaman utama untuk mengecek:
- Apakah waktu saat ini berada di antara `startDate` dan `endDate`?
- Apakah `usedQuota` masih di bawah `quota`?
- Mengembalikan data `EventConfig` (durasi *countdown*, durasi per *page*).

### 2. `POST /api/sessions/start`
Saat user klik "Mulai Photobooth" di layar awal:
1. Memvalidasi ketersediaan event dan *mengecek* apakah `usedQuota` masih di bawah `quota` (jika kuota bukan *unlimited*).
2. Membuat record `Session` baru dengan `expiresAt` berdasarkan `EventConfig.userSessionDuration`. (Catatan: `usedQuota` belum dikurangi di sini).
3. Mengembalikan `sessionId` ke Frontend untuk digunakan selama proses.

### 3. `POST /api/sessions/complete`
API yang dipanggil saat user menekan "Selesai/Cetak" di Halaman 3.
1. Menaikkan nilai `usedQuota` pada `EventConfig` sebanyak +1.
2. Mengubah status `Session` menjadi `FINISHED`.

### 4. `GET /api/templates/categories`
Mengambil seluruh kategori template beserta daftar template di dalamnya, untuk ditampilkan di Halaman 3 (*Result & Template Selection*).

### 4. Admin API (CRUD)
- `POST/PUT /api/admin/event`: Untuk mengubah rentang tanggal, kuota, dan pengaturan durasi/timer tiap halaman.
- `POST/PUT /api/admin/categories`: Untuk manajemen kategori template.

---

## 3. Rangkaian Flow Kiosk (Frontend)

1. **Halaman Home (Baru)**:
   - Menghapus logika *polling pending session* sebelumnya.
   - Menampilkan tombol **"Mulai Photobooth"**.
   - Jika ditekan, memanggil API `/api/sessions/start`, jika sukses lanjut ke **Page 1**.

2. **Page 1: Pilih Grid (`/select-grid`)**:
   - Menjalankan *timer* berdasarkan `page1Duration`. Jika *timer* habis, otomatis kembali ke Home.
   - User memilih opsi **Grid 2x3** (3 foto) atau **Grid 2x4** (4 foto). Lanjut ke **Page 2**.

3. **Page 2: Sesi Kamera (`/booth`)**:
   - Menjalankan *timer* berdasarkan `page2Duration`.
   - Menampilkan 1 tombol **"Mulai Foto Secara Otomatis"**.
   - Saat ditekan, akan otomatis melakukan hitung mundur (*countdown* sesuai konfigurasi admin) dan mengambil foto sebanyak 3 kali (untuk 2x3) atau 4 kali (untuk 2x4).
   - Setelah selesai, *preview* untuk proses *retake* akan menampilkan foto sesuai konfigurasi per-grid (misal 2x3: klik retake foto 1-2 akan meretake foto pengambilan ke-1). Lanjut ke **Page 3**.

4. **Page 3: Pilih Template & Hasil (`/editor` atau `/result`)**:
   - Menjalankan *timer* berdasarkan `page3Duration`.
   - Menampilkan daftar Kategori (*Tab* atau Dropdown).
   - **Penting:** Hanya template yang `layout`-nya sesuai dengan pilihan grid di Page 1 (misal `grid2x3` atau `grid2x4`) yang akan ditampilkan di dalam kategori tersebut.
   - Foto hasil *take* akan di-render ke *slot* template: Slot 1 & 2 diisi *Take 1*, Slot 3 & 4 diisi *Take 2*, dsb.
   - Tombol "Selesai/Cetak" untuk mengakhiri sesi.

---

## 4. Rencana Kerja Selanjutnya (*Execution Plan*)

Apabila Anda menyetujui rancangan ini, saya akan melakukan langkah-langkah berikut:
1. Memperbarui `schema.prisma`, membuat tabel baru, lalu migrasi database (`npx prisma db push`).
2. Membuat dan memodifikasi *Routes* & *Controllers* di Backend (`admin.ts`, `sessions.ts`, `templates.ts`, dan `event.ts`).
3. Mengubah halaman Admin di Frontend agar memiliki menu pengaturan Event, Durasi, dan Kategori Template.
4. Mengubah *Flow* Frontend Kiosk dari halaman Home, Page 1 (Grid), Page 2 (Kamera otomatis dengan retake), dan Page 3 (Template dengan kategori).
