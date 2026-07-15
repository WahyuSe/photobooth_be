import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import prisma from '../prisma';
import {
  createSessionFolder,
  uploadFileToDriveFolder,
} from '../services/googleDriveService';

const router = Router();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

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
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar atau video yang diizinkan.'));
    }
  },
});

// POST /api/upload — upload single image/video
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

// POST /api/upload/google-drive — legacy final-photo upload to Google Drive.
// This endpoint now requires a session identity so files do not land in the root Photobooth folder.
router.post('/google-drive', async (req: Request, res: Response): Promise<any> => {
  try {
    const { imageBase64, sessionId, sessionCode, userCode, sessionName, eventName } = req.body;

    if (!isNonEmptyString(imageBase64)) {
      return res.status(400).json({ success: false, message: 'Tidak ada data gambar base64 yang dikirim.' });
    }

    let session = null;
    if (isNonEmptyString(sessionId)) {
      session = await prisma.session.findUnique({ where: { id: sessionId } });
    } else if (isNonEmptyString(sessionCode)) {
      session = await prisma.session.findUnique({ where: { sessionCode } });
    }

    const resolvedUserCode =
      (isNonEmptyString(userCode) && userCode) ||
      (isNonEmptyString(sessionCode) && sessionCode) ||
      session?.sessionCode ||
      session?.id;

    if (!resolvedUserCode) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, sessionCode, atau userCode wajib dikirim agar file masuk ke folder user_code.',
      });
    }

    const config = await prisma.eventConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const resolvedEventName =
      (isNonEmptyString(eventName) && eventName) ||
      config?.eventName ||
      session?.sessionName ||
      (isNonEmptyString(sessionName) && sessionName) ||
      'PhotoBooth Event';

    const folderId = await createSessionFolder(resolvedEventName, resolvedUserCode);
    const uploaded = await uploadFileToDriveFolder(imageBase64, 'photo_final.jpg', 'image/jpeg', folderId);
    const driveUrl = uploaded.directLink || uploaded.webViewLink;

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          drivePhotoUrl: driveUrl,
          driveFolderId: folderId,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Foto berhasil diunggah ke folder sesi Google Drive!',
      url: driveUrl,
      fileId: uploaded.fileId,
      folderId,
      folderPath: `${resolvedEventName}/${resolvedUserCode}`,
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
