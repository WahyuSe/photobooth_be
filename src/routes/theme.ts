import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// Default fallback theme (mirrors frontend themeConfig)
const defaultTheme = {
  name: 'Default',
  isActive: true,
  colorPrimary: '#3B82F6',
  colorPrimaryHover: '#2563EB',
  colorSecondary: '#F3F4F6',
  colorBackground: '#F9FAFB',
  colorCard: '#FFFFFF',
  colorText: '#111827',
  colorTextMuted: '#6B7280',
  colorBorder: '#E5E7EB',
  colorError: '#EF4444',
  colorSuccess: '#10B981',
  fontHeading: "'Sora', sans-serif",
  fontBody: "'Plus Jakarta Sans', sans-serif",
  fontMono: "'Space Grotesk', monospace",
  radiusBase: '0.5rem',
  radiusLg: '1rem',
  radiusXl: '1.5rem',
};

// GET /api/theme — Public: ambil tema aktif
router.get('/', async (_req: Request, res: Response): Promise<any> => {
  try {
    const activeTheme = await prisma.uITheme.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!activeTheme) {
      return res.json({ success: true, data: defaultTheme });
    }

    return res.json({ success: true, data: activeTheme });
  } catch (error) {
    console.error('Error fetching active theme:', error);
    return res.json({ success: true, data: defaultTheme });
  }
});

export default router;
