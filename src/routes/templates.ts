import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/templates — list all templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return res.json({ success: true, data: templates });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/templates/:id — get single template
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.template.findUnique({
      where: { id: String(req.params.id) }
    });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });
    }
    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/templates — create new template
router.post('/', async (req: Request, res: Response) => {
  try {
    const newTemplate = await prisma.template.create({
      data: req.body
    });
    return res.json({ success: true, data: newTemplate });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: `Gagal membuat template: ${error.message || error}` });
  }
});

// PUT /api/templates/:id — update template
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.template.update({
      where: { id: String(req.params.id) },
      data: req.body
    });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: `Gagal mengupdate template: ${error.message || error}` });
  }
});

// DELETE /api/templates/:id — delete template
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.template.delete({
      where: { id: String(req.params.id) }
    });
    return res.json({ success: true, message: 'Template dihapus' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: `Gagal menghapus template: ${error.message || error}` });
  }
});

export default router;
