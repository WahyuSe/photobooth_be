# 📸 Update Plan — GIF, Live Photo & Expiry Link System

## Ringkasan Perubahan
Menambahkan fitur:
1. **Simpan hasil foto** ke Google Drive dengan struktur folder `nama_sesi/user-code/`
2. **Generate & simpan GIF** animasi dari koleksi foto yang diambil
3. **Rekam & simpan Live Photo** (video 3–5 detik) saat sesi foto
4. **Expiry link system** — hasil dapat diakses user via link/QR barcode dengan batas waktu (default 15 hari), dikonfigurasi admin

---

## Alur Final Setelah Implementasi

```
[User ambil foto] → [Editor / pilih template]
        ↓
[Klik "Selesai & Simpan"]
        ↓
[Frontend generate:]
  - 📸 Foto final (JPEG/PNG dari canvas)
  - 🎞️  GIF animasi (dari frame-frame foto)
  - 🎬  Live Photo (video WebM/MP4, 3-5 detik)
        ↓
[Upload ke Backend → Google Drive]
  Struktur: {eventName}/{sessionCode}/
    ├── photo_final.jpg
    ├── animated.gif
    └── live_photo.webm
        ↓
[Backend simpan URL ke database]
  + generate token akses + waktu expiry
        ↓
[Frontend tampilkan QR Code + link]
  → User scan → halaman /gallery/{token}
        ↓
[Halaman gallery streaming file via backend proxy]
  (tidak expose Google Drive URL langsung)
```

---

## Perubahan Database (Prisma)

### 1. Tambah field di model `Session`

```prisma
model Session {
  // ... field yang sudah ada ...

  // === TAMBAH FIELD BARU ===
  drivePhotoUrl    String?   // URL file foto final di Google Drive
  driveGifUrl      String?   // URL file GIF di Google Drive
  driveLiveUrl     String?   // URL file live video di Google Drive
  driveFolderId    String?   // ID folder Google Drive user ini
  accessToken      String?   @unique  // Token unik untuk akses halaman gallery
  tokenExpiresAt   DateTime? // Waktu expiry token akses
}
```

### 2. Tambah field di model `EventConfig`

```prisma
model EventConfig {
  // ... field yang sudah ada ...

  // === TAMBAH FIELD BARU ===
  photoExpireDays  Int  @default(15)  // Berapa hari link/token berlaku
  enableGif        Boolean @default(true)   // Admin bisa toggle fitur GIF
  enableLivePhoto  Boolean @default(true)   // Admin bisa toggle fitur Live Photo
}
```

### Migration command
```bash
npx prisma migrate dev --name add_media_upload_and_token
```

---

## Perubahan Backend

### File Baru & yang Dimodifikasi

---

### [MODIFY] `src/services/googleDriveService.ts`

Tambah fungsi baru:

```typescript
/**
 * Membuat subfolder di dalam folder induk Google Drive
 * Path: {parentFolderId}/{sessionName}/{userCode}/
 */
export async function createSessionFolder(
  sessionName: string,
  userCode: string
): Promise<string> // returns folderId
```

```typescript
/**
 * Upload file (gambar, gif, video) ke folder tertentu di Drive
 * Mendukung mimetype: image/jpeg, image/gif, video/webm
 */
export async function uploadFileToDriveFolder(
  base64Data: string,
  filename: string,
  mimeType: 'image/jpeg' | 'image/gif' | 'video/webm',
  folderId: string
): Promise<{ fileId: string; webViewLink: string; directLink: string }>
```

```typescript
/**
 * Proxy stream file dari Drive ke client
 * Agar URL Google Drive tidak terekspose langsung
 */
export async function streamFileFromDrive(
  fileId: string
): Promise<Readable>
```

---

### [NEW] `src/routes/gallery.ts`

Route baru untuk akses hasil foto user:

```
GET  /api/gallery/:token          → validasi token, return metadata (urls, expiry)
GET  /api/gallery/:token/photo    → proxy stream foto final dari Drive
GET  /api/gallery/:token/gif      → proxy stream GIF dari Drive
GET  /api/gallery/:token/live     → proxy stream video dari Drive
POST /api/gallery/save            → upload semua file + simpan ke session
```

**Logika `/api/gallery/save`:**
1. Terima `sessionId`, `photoBase64`, `gifBase64?`, `liveVideoBase64?`
2. Buat folder Drive: `{eventName}/{sessionCode}/`
3. Upload semua file ke folder tersebut
4. Generate `accessToken` unik (UUID)
5. Hitung `tokenExpiresAt` = `now + photoExpireDays * 86400 seconds`
6. Update record `Session` di database
7. Return `{ accessToken, galleryUrl: "/gallery/{token}" }`

**Logika `GET /api/gallery/:token`:**
1. Cari session berdasarkan `accessToken`
2. Cek apakah `tokenExpiresAt > now`
3. Jika expired → return 410 Gone
4. Return metadata: `{ hasPhoto, hasGif, hasLivePhoto, sessionName, expiresAt }`

**Logika `/api/gallery/:token/photo` (dan gif, live):**
1. Validasi token + expiry
2. Ambil `drivePhotoUrl` dari session → ekstrak fileId
3. Stream file dari Drive ke response (dengan header `Content-Type` yang tepat)

---

### [MODIFY] `src/routes/upload.ts`

Update filter MIME type untuk menerima video:

```typescript
// Sebelum
if (file.mimetype.startsWith('image/')) { ... }

// Sesudah
if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) { ... }
```

Update limit file size:
```typescript
limits: { fileSize: 50 * 1024 * 1024 }, // naik dari 20MB ke 50MB (untuk video)
```

---

### [MODIFY] `src/routes/admin.ts`

Tambah handling `photoExpireDays`, `enableGif`, `enableLivePhoto` di endpoint `POST /api/admin/event/config`.

---

### [MODIFY] `src/index.ts`

Daftarkan route baru:
```typescript
import galleryRoutes from './routes/gallery';
app.use('/api/gallery', galleryRoutes);
```

---

## Perubahan Frontend (Next.js)

### File Baru & yang Dimodifikasi

---

### [NEW] `app/gallery/[token]/page.tsx`

Halaman publik yang diakses user via link/QR:

```
URL: /gallery/abc123xyz

Tampilan:
┌─────────────────────────────────┐
│  📸 Foto Kamu dari [Event Name] │
│  Berlaku hingga: DD MMM YYYY    │
├─────────────────────────────────┤
│  [ Foto Final ]                 │
│  [Download JPG]                 │
├─────────────────────────────────┤
│  [ GIF Animasi ] (jika ada)     │
│  [Download GIF]                 │
├─────────────────────────────────┤
│  [ Live Photo Video ] (jika ada)│
│  [Download Video]               │
└─────────────────────────────────┘
```

- Semua file di-load dari `/api/gallery/:token/photo`, `/gif`, `/live`
- Tidak ada URL Google Drive yang terekspose ke user
- Tampilkan countdown "Link berlaku X hari lagi"
- Jika token expired → halaman 410 "Link sudah kadaluarsa"

---

### [NEW] `components/UI/QRCodeModal.tsx`

Modal yang muncul setelah user klik "Selesai & Simpan":

```
┌──────────────────────────────┐
│  ✅ Foto Berhasil Disimpan!  │
│                              │
│  [  QR Code  ]               │
│                              │
│  atau copy link:             │
│  https://app.com/gallery/... │
│  [Salin Link]                │
│                              │
│  Link berlaku 15 hari        │
│  [Selesai]                   │
└──────────────────────────────┘
```

Gunakan library `qrcode.react` untuk generate QR code di client.

---

### [MODIFY] `components/Editor/EditorClient.tsx`

Tambah logika di fungsi `handleSave`/`handleFinish`:

**Step 1 — Generate GIF (client-side dengan `gifshot`):**
```typescript
import gifshot from 'gifshot';

const generateGif = async (photos: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    gifshot.createGIF({
      images: photos,
      gifWidth: 800,
      gifHeight: 600,
      interval: 0.5,       // 0.5s per frame
      numFrames: photos.length,
    }, (obj) => {
      if (!obj.error) resolve(obj.image); // base64 GIF
      else reject(obj.error);
    });
  });
};
```

**Step 2 — Kirim ke backend:**
```typescript
const saveToGallery = async () => {
  const photoBase64 = canvasRef.current?.toDataURL('image/jpeg', 0.9);
  const gifBase64 = await generateGif(photos);
  // liveVideoBase64 dari MediaRecorder (lihat BoothClient)

  const res = await fetch(`${API_URL}/api/gallery/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      photoBase64,
      gifBase64,
      liveVideoBase64,  // opsional
    }),
  });
  const data = await res.json();
  // Tampilkan QRCodeModal dengan data.galleryUrl
};
```

---

### [MODIFY] `components/Booth/BoothClient.tsx`

Tambah **Live Photo recording** menggunakan `MediaRecorder`:

```typescript
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const liveVideoChunksRef = useRef<Blob[]>([]);
const [liveVideoBase64, setLiveVideoBase64] = useState<string | null>(null);

// Mulai rekam saat countdown dimulai
const startLiveRecording = () => {
  const stream = webcamRef.current?.stream;
  if (!stream) return;

  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  mediaRecorderRef.current = recorder;
  liveVideoChunksRef.current = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) liveVideoChunksRef.current.push(e.data);
  };

  recorder.onstop = async () => {
    const blob = new Blob(liveVideoChunksRef.current, { type: 'video/webm' });
    const base64 = await blobToBase64(blob);
    setLiveVideoBase64(base64);
  };

  recorder.start();

  // Auto stop setelah 5 detik
  setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, 5000);
};

// Panggil startLiveRecording() bersamaan dengan startCountdown()
```

Simpan `liveVideoBase64` ke `localStorage` agar bisa diakses dari `EditorClient`.

---

### [NEW] `app/admin/components/GallerySettingsTab.tsx` _(opsional)_

Tab baru di halaman Admin untuk konfigurasi:
- **Masa berlaku link** (input angka hari, default 15)
- **Toggle aktifkan GIF**
- **Toggle aktifkan Live Photo**
- Tabel daftar session dengan link gallery-nya (untuk admin monitoring)

---

## Dependensi Baru

### Frontend
```bash
npm install gifshot qrcode.react
npm install -D @types/gifshot
```

| Library | Fungsi |
|---|---|
| `gifshot` | Generate GIF animasi dari array base64 image di client |
| `qrcode.react` | Render QR Code dari URL gallery |

### Backend
Tidak perlu library tambahan. `sharp` sudah terpasang dan Google Drive API sudah ada.

---

## Alur Google Drive Folder

```
Google Drive Root/
└── {GOOGLE_DRIVE_FOLDER_ID}/      ← env yang sudah ada
    └── Pernikahan Budi-Ani/       ← EventConfig.eventName
        ├── ABC123/                 ← Session.sessionCode (user-code)
        │   ├── photo_final.jpg
        │   ├── animated.gif
        │   └── live_photo.webm
        └── XYZ789/
            ├── photo_final.jpg
            └── animated.gif
```

---

## Estimasi Kompleksitas

| Komponen | Estimasi Waktu | Tingkat Kesulitan |
|---|---|---|
| Prisma migration (DB) | 30 menit | 🟢 Mudah |
| Backend: googleDriveService update | 2–3 jam | 🟡 Sedang |
| Backend: route `/api/gallery` baru | 2–3 jam | 🟡 Sedang |
| Frontend: GIF generation (gifshot) | 1–2 jam | 🟢 Mudah |
| Frontend: Live Photo (MediaRecorder) | 2–3 jam | 🟡 Sedang |
| Frontend: Halaman `/gallery/[token]` | 2–3 jam | 🟢 Mudah |
| Frontend: QRCodeModal | 1 jam | 🟢 Mudah |
| Admin: setting expire days + toggles | 1–2 jam | 🟢 Mudah |
| **Total** | **~12–17 jam** | |

---

## Urutan Implementasi (Disarankan)

```
1. [DB]       Prisma schema update + migrate
2. [BE]       Update googleDriveService.ts (folder + multi-file upload)
3. [BE]       Buat route /api/gallery (save + proxy stream)
4. [BE]       Update upload.ts (mime type + size limit)
5. [FE]       Live Photo recording di BoothClient
6. [FE]       GIF generation di EditorClient
7. [FE]       Integrasi save → /api/gallery/save
8. [FE]       Halaman /gallery/[token]
9. [FE]       QRCodeModal
10.[FE+BE]    Admin setting: expire days, toggle GIF/Live
```

---

> [!IMPORTANT]
> **Google Apps Script proxy** yang sudah ada hanya mendukung gambar. Untuk upload GIF & video ke Drive, perlu update Apps Script agar menerima `mimeType` dinamis, atau gunakan path Service Account langsung (yang sudah ada sebagai fallback).

> [!WARNING]
> Live Photo menggunakan `MediaRecorder` API dengan `mimeType: 'video/webm'`. Safari iOS **tidak mendukung WebM**. Jika perlu support iOS, gunakan `video/mp4` atau deteksi MIME support dengan `MediaRecorder.isTypeSupported()`.

> [!NOTE]
> File di Google Drive **tidak otomatis dihapus** meski token sudah expired. Cleanup storage perlu cron job terpisah atau dilakukan manual dari admin panel. Token di DB cukup di-check saat request masuk.
