import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/event/config (Public)
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await prisma.eventConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!config) {
      return res.status(404).json({ success: false, message: 'Tidak ada event aktif saat ini' });
    }

    return res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching event config:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/event/categories (Public)
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.templateCategory.findMany({
      include: {
        templates: true
      }
    });
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching template categories:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
