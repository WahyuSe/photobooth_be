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

// POST /api/sessions/start
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { gridType } = req.body;
    
    // 1. Dapatkan config aktif
    const config = await prisma.eventConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!config) {
      return res.status(400).json({ success: false, message: 'Tidak ada event aktif' });
    }

    const now = new Date();
    if (now < config.startDate || now > config.endDate) {
      return res.status(400).json({ success: false, message: 'Event sedang tidak berlangsung saat ini' });
    }

    if (config.quota > 0 && config.usedQuota >= config.quota) {
      return res.status(400).json({ success: false, message: 'Kuota event sudah habis' });
    }

    // 2. Buat sesi
    const expiresAt = new Date(now.getTime() + config.userSessionDuration * 1000);
    const code = await generateUniqueCode();
    
    const session = await prisma.session.create({
      data: {
        gridType, // Bisa null jika belum dipilih
        sessionCode: code,
        sessionName: config.eventName,
        userName: `Guest-${code}`,
        expiresAt,
        status: 'ACTIVE',
        isActive: true,
      }
    });

    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error starting session:', error);
    return res.status(500).json({ success: false, message: 'Gagal memulai sesi' });
  }
});

// POST /api/sessions/complete
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || !session.isActive) {
      return res.status(400).json({ success: false, message: 'Sesi tidak valid atau sudah selesai' });
    }

    // Update Session
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'FINISHED',
        isActive: false,
        endedAt: new Date()
      }
    });

    // Update Quota
    const config = await prisma.eventConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (config) {
      await prisma.eventConfig.update({
        where: { id: config.id },
        data: { usedQuota: { increment: 1 } }
      });
    }

    return res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error completing session:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyelesaikan sesi' });
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
