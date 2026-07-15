import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';
import {
  createSessionFolder,
  DriveUploadMimeType,
  getDriveFileMetadata,
  streamFileFromDrive,
  uploadFileToDriveFolder,
} from '../services/googleDriveService';

const router = Router();
const DEFAULT_EXPIRE_DAYS = 15;

type GalleryMediaKind = 'photo' | 'gif' | 'live';

const mediaConfig: Record<GalleryMediaKind, { field: 'drivePhotoUrl' | 'driveGifUrl' | 'driveLiveUrl'; contentType: string; filename: string }> = {
  photo: { field: 'drivePhotoUrl', contentType: 'image/jpeg', filename: 'photo_final.jpg' },
  gif: { field: 'driveGifUrl', contentType: 'image/gif', filename: 'animated.gif' },
  live: { field: 'driveLiveUrl', contentType: 'video/webm', filename: 'live_photo.webm' },
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getLiveVideoMimeType(base64Data: string): DriveUploadMimeType {
  return base64Data.startsWith('data:video/mp4') ? 'video/mp4' : 'video/webm';
}

function getLiveVideoFilename(mimeType: DriveUploadMimeType): string {
  return mimeType === 'video/mp4' ? 'live_photo.mp4' : 'live_photo.webm';
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function extractDriveFileId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  const filePathMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  if (filePathMatch?.[1]) {
    return filePathMatch[1];
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get('id');
  } catch (_error) {
    return null;
  }
}

function isDownloadRequest(req: Request): boolean {
  const download = req.query.download;
  return download === '1' || download === 'true' || download === 'yes';
}

function sanitizeHeaderFilename(filename: string): string {
  return filename.replace(/["\r\n]/g, '_');
}

async function getValidSessionByToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { accessToken: token },
  });

  if (!session) {
    return { session: null, status: 404, message: 'Gallery tidak ditemukan.' };
  }

  if (!session.tokenExpiresAt || session.tokenExpiresAt <= new Date()) {
    return { session: null, status: 410, message: 'Link gallery sudah kadaluarsa.' };
  }

  return { session, status: 200, message: 'OK' };
}

// POST /api/gallery/save
router.post('/save', async (req: Request, res: Response): Promise<any> => {
  try {
    const { sessionId, photoBase64, gifBase64, liveVideoBase64 } = req.body;

    if (!isNonEmptyString(sessionId)) {
      return res.status(400).json({ success: false, message: 'sessionId wajib dikirim.' });
    }

    if (!isNonEmptyString(photoBase64)) {
      return res.status(400).json({ success: false, message: 'photoBase64 wajib dikirim.' });
    }

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });
    }

    const config = await prisma.eventConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const eventName = config?.eventName || session.sessionName || 'PhotoBooth Event';
    const userCode = session.sessionCode || session.id;
    const folderId = await createSessionFolder(eventName, userCode);
    const now = new Date();
    const expireDays = config?.photoExpireDays && config.photoExpireDays > 0 ? config.photoExpireDays : DEFAULT_EXPIRE_DAYS;
    const tokenExpiresAt = addDays(now, expireDays);

    const photoUpload = await uploadFileToDriveFolder(photoBase64, 'photo_final.jpg', 'image/jpeg', folderId);

    let gifUrl: string | null = null;
    if ((config?.enableGif ?? true) && isNonEmptyString(gifBase64)) {
      const gifUpload = await uploadFileToDriveFolder(gifBase64, 'animated.gif', 'image/gif', folderId);
      gifUrl = gifUpload.directLink || gifUpload.webViewLink;
    }

    let liveUrl: string | null = null;
    if ((config?.enableLivePhoto ?? true) && isNonEmptyString(liveVideoBase64)) {
      const liveMimeType = getLiveVideoMimeType(liveVideoBase64);
      const liveUpload = await uploadFileToDriveFolder(
        liveVideoBase64,
        getLiveVideoFilename(liveMimeType),
        liveMimeType,
        folderId,
      );
      liveUrl = liveUpload.directLink || liveUpload.webViewLink;
    }

    const accessToken = crypto.randomUUID();
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        drivePhotoUrl: photoUpload.directLink || photoUpload.webViewLink,
        driveGifUrl: gifUrl,
        driveLiveUrl: liveUrl,
        driveFolderId: folderId,
        accessToken,
        tokenExpiresAt,
      },
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        galleryUrl: `/gallery/${accessToken}`,
        expiresAt: updatedSession.tokenExpiresAt,
        hasPhoto: Boolean(updatedSession.drivePhotoUrl),
        hasGif: Boolean(updatedSession.driveGifUrl),
        hasLivePhoto: Boolean(updatedSession.driveLiveUrl),
      },
    });
  } catch (error: any) {
    console.error('[Gallery Save Error]', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Gagal menyimpan gallery.',
    });
  }
});

// GET /api/gallery/:token
router.get('/:token', async (req: Request, res: Response): Promise<any> => {
  try {
    const token = String(req.params.token);
    const result = await getValidSessionByToken(token);

    if (!result.session) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      data: {
        hasPhoto: Boolean(result.session.drivePhotoUrl),
        hasGif: Boolean(result.session.driveGifUrl),
        hasLivePhoto: Boolean(result.session.driveLiveUrl),
        sessionName: result.session.sessionName,
        sessionCode: result.session.sessionCode,
        expiresAt: result.session.tokenExpiresAt,
      },
    });
  } catch (error) {
    console.error('[Gallery Metadata Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil metadata gallery.' });
  }
});

async function streamGalleryMedia(req: Request, res: Response, kind: GalleryMediaKind): Promise<any> {
  try {
    const token = String(req.params.token);
    const result = await getValidSessionByToken(token);

    if (!result.session) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const config = mediaConfig[kind];
    const driveUrl = result.session[config.field];
    if (!driveUrl) {
      return res.status(404).json({ success: false, message: 'Media tidak tersedia.' });
    }

    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) {
      return res.status(500).json({ success: false, message: 'File ID Google Drive tidak valid.' });
    }

    const [metadata, stream] = await Promise.all([
      getDriveFileMetadata(fileId),
      streamFileFromDrive(fileId),
    ]);
    const contentType = metadata.mimeType || config.contentType;
    const filename = metadata.name || config.filename;

    const disposition = isDownloadRequest(req) ? 'attachment' : 'inline';
    const safeFilename = sanitizeHeaderFilename(filename);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'private, max-age=300');

    stream.on('error', (error) => {
      console.error(`[Gallery Stream ${kind} Error]`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Gagal streaming media.' });
      } else {
        res.end();
      }
    });

    return stream.pipe(res);
  } catch (error) {
    console.error(`[Gallery Stream ${kind} Error]`, error);
    return res.status(500).json({ success: false, message: 'Gagal streaming media.' });
  }
}

// GET /api/gallery/:token/photo
router.get('/:token/photo', (req: Request, res: Response): Promise<any> => streamGalleryMedia(req, res, 'photo'));

// GET /api/gallery/:token/gif
router.get('/:token/gif', (req: Request, res: Response): Promise<any> => streamGalleryMedia(req, res, 'gif'));

// GET /api/gallery/:token/live
router.get('/:token/live', (req: Request, res: Response): Promise<any> => streamGalleryMedia(req, res, 'live'));

export default router;

