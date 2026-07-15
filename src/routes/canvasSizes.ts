import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

const getActiveFilter = (active: unknown) => {
  if (active === undefined) return true;
  return active === true || active === 'true' || active === '1';
};

// GET /api/canvas-sizes?layoutType=grid2x3&active=true
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const layoutType = typeof req.query.layoutType === 'string' ? req.query.layoutType : undefined;
    const aspectRatio = typeof req.query.aspectRatio === 'string' ? req.query.aspectRatio : undefined;
    const isActive = getActiveFilter(req.query.active);

    const presets = await prisma.canvasSize.findMany({
      where: {
        isActive,
        ...(layoutType ? { layoutType: { in: [layoutType, '*'] } } : {}),
        ...(aspectRatio ? { aspectRatio } : {}),
      },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return res.json({ success: true, data: presets });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil preset ukuran canvas' });
  }
});

// GET /api/canvas-sizes/default?layoutType=grid2x3
router.get('/default', async (req: Request, res: Response): Promise<any> => {
  try {
    const layoutType = typeof req.query.layoutType === 'string' ? req.query.layoutType : '*';

    const preset = await prisma.canvasSize.findFirst({
      where: {
        isActive: true,
        isDefault: true,
        layoutType: { in: [layoutType, '*'] },
      },
      orderBy: [
        { layoutType: layoutType === '*' ? 'asc' : 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return res.json({ success: true, data: preset });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil preset default' });
  }
});

// GET /api/canvas-sizes/:id
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const preset = await prisma.canvasSize.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!preset) {
      return res.status(404).json({ success: false, message: 'Preset ukuran canvas tidak ditemukan' });
    }

    return res.json({ success: true, data: preset });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil preset ukuran canvas' });
  }
});

export default router;
