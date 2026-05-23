import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import emailRoutes from './routes/email';
import templateRoutes from './routes/templates';
import uploadRoutes from './routes/upload';
import sessionRoutes from './routes/sessions';
import adminRoutes from './routes/admin';
import prisma from './prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // 1. Izinkan request tanpa origin (seperti curl atau server-to-server)
    if (!origin) return callback(null, true);

    // 2. Izinkan local development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // 3. Izinkan yang cocok dengan FRONTEND_URL yang dikonfigurasi
    if (FRONTEND_URL && (origin === FRONTEND_URL || origin.replace(/\/$/, '') === FRONTEND_URL)) {
      return callback(null, true);
    }

    // 4. Izinkan domain vercel.app apa pun (termasuk preview link dan subdomain)
    if (origin.endsWith('.vercel.app') || origin === 'https://vercel.app') {
      return callback(null, true);
    }

    // 5. Fallback: Berikan peringatan di log tapi tetap izinkan agar Kiosk tidak macet di lapangan
    console.warn(`⚠️ CORS Request dari origin tidak terdaftar: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static - serve template assets
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
// Routes
app.use('/api/email', emailRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'PhotoBooth Backend is running 📸', timestamp: new Date().toISOString() });
});

const seedTemplates = async () => {
  const count = await prisma.template.count();
  if (count === 0) {
    console.log('🌱 Seeding default templates...');
    await prisma.template.createMany({
      data: [
        {
          name: '🤍 Classic Strip',
          description: 'Strip 4 foto vertikal klasik ala photobooth retro',
          layout: 'strip',
          photoCount: 4,
          frameColor: '#e0e0e0',
          backgroundColor: '#ffffff',
          textColor: '#1a1a1a',
          accentColor: '#e91e8c',
          fonts: 'Georgia',
        },
        {
          name: '✨ Dark Elegant',
          description: 'Strip elegan dengan background gelap mewah',
          layout: 'strip',
          photoCount: 4,
          frameColor: '#d4af37',
          backgroundColor: '#1a1a2e',
          textColor: '#d4af37',
          accentColor: '#f4e157',
          fonts: 'Playfair Display',
        },
        {
          name: '⬛ Grid Modern',
          description: 'Grid 2x2 minimalis dengan desain modern',
          layout: 'grid2x2',
          photoCount: 4,
          frameColor: '#2d2d2d',
          backgroundColor: '#f5f5f5',
          textColor: '#2d2d2d',
          accentColor: '#6200ea',
          fonts: 'Inter',
          aspectRatio: '2:3',
        }
      ]
    });
    console.log('✅ Templates seeded!');
  }
};

// Start listening only in non-serverless environments (local development)
if (!process.env.VERCEL) {
  // Run template seeding asynchronously at startup only in local development
  seedTemplates().catch(err => console.error('🌱 Gagal seeding templates:', err));

  app.listen(PORT, () => {
    console.log(`\n🚀 PhotoBooth Backend running at http://localhost:${PORT}`);
    console.log(`📧 Email: Nodemailer (SMTP)`);
    console.log(`🎨 Templates: Ready\n`);
  });
}

export default app;

