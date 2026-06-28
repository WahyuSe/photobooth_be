import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma';

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

// --- EVENT CONFIG ADMIN ---

// GET /api/admin/event/config
router.get('/event/config', async (_req: Request, res: Response) => {
  try {
    const config = await prisma.eventConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/event/config
router.post('/event/config', async (req: Request, res: Response) => {
  try {
    const { isNew, ...data } = req.body;
    
    // Parse dates if provided as strings
    if (data.startDate) {
      if (typeof data.startDate === 'string' && !data.startDate.includes('Z') && !data.startDate.includes('+') && !data.startDate.includes('-')) {
        data.startDate = new Date(data.startDate + '+08:00');
      } else {
        data.startDate = new Date(data.startDate);
      }
    }
    if (data.endDate) {
      if (typeof data.endDate === 'string' && !data.endDate.includes('Z') && !data.endDate.includes('+') && !data.endDate.includes('-')) {
        data.endDate = new Date(data.endDate + '+08:00');
      } else {
        data.endDate = new Date(data.endDate);
      }
    }

    let updatedConfig;

    if (isNew) {
      // Nonaktifkan semua event config yang lama
      await prisma.eventConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      // Buat event config baru (usedQuota otomatis 0)
      updatedConfig = await prisma.eventConfig.create({
        data: { ...data, usedQuota: 0, isActive: true }
      });
    } else {
      // Update config yang sedang aktif
      const config = await prisma.eventConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      if (config) {
        updatedConfig = await prisma.eventConfig.update({
          where: { id: config.id },
          data
        });
      } else {
        updatedConfig = await prisma.eventConfig.create({
          data: { ...data, usedQuota: 0, isActive: true }
        });
      }
    }
    return res.json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal update event config' });
  }
});

// --- TEMPLATE CATEGORIES ADMIN ---

// GET /api/admin/categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.templateCategory.findMany();
    return res.json({ success: true, data: categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/categories
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.templateCategory.create({
      data: { name, description }
    });
    return res.json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal buat kategori' });
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.templateCategory.update({
      where: { id: req.params.id as string },
      data: { name, description }
    });
    return res.json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal update kategori' });
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    await prisma.templateCategory.delete({
      where: { id: req.params.id as string }
    });
    return res.json({ success: true, message: 'Kategori dihapus' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal hapus kategori' });
  }
});

export default router;

