import { Router, Request, Response } from 'express';
import { sendPhotoEmail } from '../services/emailService';

const router = Router();

// POST /api/email/send
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { email, name, imageBase64, mimeType } = req.body;

    if (!email || !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Email dan imageBase64 wajib diisi.',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid.',
      });
    }

    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    await sendPhotoEmail({
      to: email,
      recipientName: name || 'Teman',
      imageBase64: base64Data,
      mimeType: mimeType || 'image/jpeg',
    });

    return res.json({
      success: true,
      message: `Foto berhasil dikirim ke ${email}`,
    });
  } catch (error: unknown) {
    console.error('[Email Error]', error);
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim email.';
    return res.status(500).json({
      success: false,
      message,
    });
  }
});

// GET /api/email/verify — check SMTP connection
router.get('/verify', async (_req: Request, res: Response) => {
  try {
    const { verifyEmailConnection } = await import('../services/emailService');
    const ok = await verifyEmailConnection();
    return res.json({ connected: ok });
  } catch {
    return res.json({ connected: false });
  }
});

export default router;
