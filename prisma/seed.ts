import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Menghapus data template dan kategori lama...');
  // Hapus semua template terlebih dahulu untuk menghindari foreign key constraint error
  await prisma.template.deleteMany();
  await prisma.templateCategory.deleteMany();

  console.log('Membuat kategori template...');
  const minimalistCategory = await prisma.templateCategory.create({
    data: {
      name: 'Minimalist',
      description: 'Desain bersih dan modern dengan elemen sederhana',
    },
  });

  const vintageCategory = await prisma.templateCategory.create({
    data: {
      name: 'Vintage',
      description: 'Gaya retro dengan nuansa klasik',
    },
  });

  const partyCategory = await prisma.templateCategory.create({
    data: {
      name: 'Party / Fun',
      description: 'Warna cerah dengan elemen menyenangkan untuk acara pesta',
    },
  });

  console.log('Membuat template...');

  // --- GRID 2x3 TEMPLATES ---
  
  await prisma.template.create({
    data: {
      name: 'Clean White 2x3',
      description: 'Grid 2x3 dengan frame putih bersih',
      layout: 'grid2x3',
      photoCount: 6,
      categoryId: minimalistCategory.id,
      frameColor: '#FFFFFF',
      backgroundColor: '#E2E8F0',
      textColor: '#0F172A',
      accentColor: '#3B82F6',
      fonts: 'Inter',
      hasLogo: true,
      hasDate: true,
      hasFrame: true,
      frameWidth: 24,
      aspectRatio: '2:3',
    },
  });

  await prisma.template.create({
    data: {
      name: 'Dark Elegance 2x3',
      description: 'Grid 2x3 elegan dengan tema gelap',
      layout: 'grid2x3',
      photoCount: 6,
      categoryId: minimalistCategory.id,
      frameColor: '#1E293B',
      backgroundColor: '#0F172A',
      textColor: '#F8FAFC',
      accentColor: '#F59E0B',
      fonts: 'Outfit',
      hasLogo: true,
      hasDate: true,
      hasFrame: true,
      frameWidth: 20,
      aspectRatio: '2:3',
    },
  });

  await prisma.template.create({
    data: {
      name: 'Classic Film 2x3',
      description: 'Nuansa roll film klasik dengan grid 2x3',
      layout: 'grid2x3',
      photoCount: 6,
      categoryId: vintageCategory.id,
      frameColor: '#D4D4D8',
      backgroundColor: '#3F3F46',
      textColor: '#F4F4F5',
      accentColor: '#EF4444',
      fonts: 'Roboto',
      hasLogo: false,
      hasDate: true,
      hasFrame: true,
      frameWidth: 30,
      aspectRatio: '2:3',
    },
  });

  // --- GRID 2x4 TEMPLATES ---

  await prisma.template.create({
    data: {
      name: 'Party Pop 2x4',
      description: 'Warna cerah untuk memeriahkan suasana grid 2x4',
      layout: 'grid2x4',
      photoCount: 8,
      categoryId: partyCategory.id,
      frameColor: '#FDF2F8',
      backgroundColor: '#FBCFE8',
      textColor: '#831843',
      accentColor: '#EC4899',
      fonts: 'Outfit',
      hasLogo: true,
      hasDate: true,
      hasFrame: true,
      frameWidth: 25,
      aspectRatio: '1:2',
    },
  });

  await prisma.template.create({
    data: {
      name: 'Retro Disco 2x4',
      description: 'Gaya neon dan retro 80an grid 2x4',
      layout: 'grid2x4',
      photoCount: 8,
      categoryId: vintageCategory.id,
      frameColor: '#4C1D95',
      backgroundColor: '#2E1065',
      textColor: '#DDD6FE',
      accentColor: '#A78BFA',
      fonts: 'Inter',
      hasLogo: true,
      hasDate: false,
      hasFrame: true,
      frameWidth: 20,
      aspectRatio: '1:2',
    },
  });

  await prisma.template.create({
    data: {
      name: 'Simple Grid 2x4',
      description: 'Grid standar 2x4 untuk foto maksimal',
      layout: 'grid2x4',
      photoCount: 8,
      categoryId: minimalistCategory.id,
      frameColor: '#F8FAFC',
      backgroundColor: '#CBD5E1',
      textColor: '#1E293B',
      accentColor: '#0F172A',
      fonts: 'Inter',
      hasLogo: true,
      hasDate: true,
      hasFrame: true,
      frameWidth: 15,
      aspectRatio: '1:2',
    },
  });

  console.log('Seed berhasil dijalankan!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
