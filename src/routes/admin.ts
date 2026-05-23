import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const settingsFilePath = isVercel
  ? '/tmp/settings.json'
  : path.join(__dirname, '../../settings.json');

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === adminPassword) {
    // Return a simple token (in a real app, use JWT)
    return res.json({ success: true, token: 'admin-auth-token-valid' });
  }

  return res.status(401).json({ success: false, message: 'Password salah' });
});

// GET /api/admin/settings - Read system settings
router.get('/settings', (_req: Request, res: Response): any => {
  try {
    if (!fs.existsSync(settingsFilePath)) {
      return res.json({ success: true, data: { whatsappEnabled: false } });
    }
    const rawData = fs.readFileSync(settingsFilePath, 'utf8');
    const settings = JSON.parse(rawData);
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal membaca pengaturan.' });
  }
});

// POST /api/admin/settings - Update system settings
router.post('/settings', (req: Request, res: Response): any => {
  try {
    const newSettings = req.body;
    let currentSettings = { whatsappEnabled: false };

    if (fs.existsSync(settingsFilePath)) {
      try {
        const rawData = fs.readFileSync(settingsFilePath, 'utf8');
        currentSettings = JSON.parse(rawData);
      } catch (e) {
        console.error(e);
      }
    }

    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };

    fs.writeFileSync(settingsFilePath, JSON.stringify(updatedSettings, null, 2), 'utf8');
    return res.json({ success: true, message: 'Pengaturan berhasil diperbarui.', data: updatedSettings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengaturan.' });
  }
});

export default router;

