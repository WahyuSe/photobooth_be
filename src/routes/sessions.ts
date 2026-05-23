import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// Helper function to generate unique 6-character session code
async function generateUniqueCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Verify uniqueness in database
  const exists = await prisma.session.findUnique({
    where: { sessionCode: code }
  });
  
  if (exists) {
    return generateUniqueCode(); // Regenerate recursively if not unique
  }
  
  return code;
}

// POST /api/sessions/create-pending (Admin)
router.post('/create-pending', async (req: Request, res: Response) => {
  try {
    const { userName = 'Guest', sessionName = '', durationMinutes = 10 } = req.body;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Number(durationMinutes));

    const sessionCode = await generateUniqueCode();

    const session = await prisma.session.create({
      data: {
        userName,
        sessionName,
        sessionCode,
        expiresAt,
        status: 'PENDING',
        isActive: true
      }
    });

    return res.json({ success: true, data: session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal membuat sesi pending' });
  }
});

// GET /api/sessions/pending (Kiosk Polling)
router.get('/pending', async (_req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { status: 'PENDING', isActive: true },
      orderBy: { startTime: 'asc' }
    });
    return res.json({ success: true, data: session });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/sessions/:id/status
router.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body; // 'ACTIVE', 'FINISHED', 'CANCELLED'
    const isActive = status === 'ACTIVE' || status === 'PENDING';
    
    const updated = await prisma.session.update({
      where: { id: String(req.params.id) },
      data: { 
        status, 
        isActive,
        endedAt: !isActive ? new Date() : null
      }
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengubah status sesi' });
  }
});

// POST /api/sessions/:id/heartbeat
router.post('/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: String(req.params.id) } });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (!session.isActive || session.expiresAt < new Date() || session.status === 'CANCELLED' || session.status === 'FINISHED') {
      // Mark as cancelled if time is up and it was ACTIVE
      if (session.isActive && session.expiresAt < new Date()) {
        await prisma.session.update({
          where: { id: String(req.params.id) },
          data: { isActive: false, status: 'CANCELLED', endedAt: new Date() }
        });
      }
      return res.json({ success: true, active: false, status: session.status, message: 'Sesi telah berakhir' });
    }

    const updated = await prisma.session.update({
      where: { id: String(req.params.id) },
      data: { lastPingAt: new Date() }
    });

    return res.json({ success: true, active: true, status: updated.status, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/sessions/history (For Admin)
router.get('/history', async (req: Request, res: Response) => {
  try {
    // Bersihkan sesi aktif yang sudah melewati batas waktu (expired) secara otomatis
    await prisma.session.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() }
      },
      data: {
        isActive: false,
        status: 'CANCELLED',
        endedAt: new Date()
      }
    });

    const { search } = req.query;
    const searchStr = typeof search === 'string' ? search.trim() : '';

    const whereClause = searchStr ? {
      OR: [
        { userName: { contains: searchStr, mode: 'insensitive' } },
        { sessionName: { contains: searchStr, mode: 'insensitive' } },
        { sessionCode: { contains: searchStr, mode: 'insensitive' } }
      ]
    } : {};

    const sessions = await prisma.session.findMany({
      where: whereClause as any,
      orderBy: { startTime: 'desc' },
      take: 20
    });
    return res.json({ success: true, data: sessions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil sesi' });
  }
});

export default router;
