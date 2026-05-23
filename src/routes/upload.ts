import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { uploadBase64ToDrive } from '../services/googleDriveService';

const router = Router();

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../../uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.warn('⚠️ Gagal membuat folder uploads (bisa diabaikan di Vercel):', error);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan.'));
    }
  },
});

// POST /api/upload — upload single image
router.post('/', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
  }
  return res.json({
    success: true,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
  });
});

// DELETE /api/upload/:filename
router.delete('/:filename', (req: Request, res: Response) => {
  const filePath = path.join(uploadsDir, String(req.params.filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: 'File dihapus.' });
  }
  return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
});

// POST /api/upload/google-drive — upload base64 to google drive
router.post('/google-drive', async (req: Request, res: Response): Promise<any> => {
  try {
    const { imageBase64, sessionName } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Tidak ada data gambar base64 yang dikirim.' });
    }

    const filename = `photobooth-${sessionName || 'session'}-${Date.now()}.jpg`;
    const driveUrl = await uploadBase64ToDrive(imageBase64, filename);

    return res.json({
      success: true,
      message: 'Foto berhasil diunggah ke Google Drive!',
      url: driveUrl,
    });
  } catch (error: any) {
    console.error('[Google Drive Route Error]', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Gagal mengunggah ke Google Drive.',
    });
  }
});

export default router;

