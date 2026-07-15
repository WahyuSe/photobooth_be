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

  console.log('Membuat preset ukuran canvas...');

  // Hapus data lama jika ada
  await prisma.canvasSize.deleteMany();

  // Preset 4R (102mm x 152mm) → cocok untuk grid2x3, grid2x4, dan strip
  // Pada 300 DPI: 4R = 1205 x 1795 px ≈ dibulatkan ke 1200 x 1800
  await prisma.canvasSize.createMany({
    data: [
      // --- Grid 2x3 ---
      {
        name: '4R',
        description: 'Ukuran cetak 4R (10x15 cm) — standar fotobooth, resolusi 300 DPI',
        layoutType: 'grid2x3',
        aspectRatio: '2:3',
        canvasWidth: 1200,
        canvasHeight: 1800,
        printDpi: 300,
        printWidthMm: 102,
        printHeightMm: 152,
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      },
      {
        name: 'A4 Portrait',
        description: 'Ukuran cetak A4 (21x29.7 cm) — cocok untuk cetakan event besar, 150 DPI',
        layoutType: 'grid2x3',
        aspectRatio: '2:3',
        canvasWidth: 1240,
        canvasHeight: 1754,
        printDpi: 150,
        printWidthMm: 210,
        printHeightMm: 297,
        isActive: true,
        isDefault: false,
        sortOrder: 2,
      },
      // --- Grid 2x4 ---
      {
        name: '4R',
        description: 'Ukuran cetak 4R (10x15 cm) — standar fotobooth, resolusi 300 DPI',
        layoutType: 'grid2x4',
        aspectRatio: '2:3',
        canvasWidth: 1200,
        canvasHeight: 1800,
        printDpi: 300,
        printWidthMm: 102,
        printHeightMm: 152,
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      },
      {
        name: 'A4 Portrait',
        description: 'Ukuran cetak A4 (21x29.7 cm), 150 DPI',
        layoutType: 'grid2x4',
        aspectRatio: '2:3',
        canvasWidth: 1240,
        canvasHeight: 1754,
        printDpi: 150,
        printWidthMm: 210,
        printHeightMm: 297,
        isActive: true,
        isDefault: false,
        sortOrder: 2,
      },
      // --- Strip (4 foto vertikal) ---
      {
        name: 'Strip Standar',
        description: 'Strip 4 foto — lebar 6 cm x tinggi 18 cm, 300 DPI',
        layoutType: 'strip',
        aspectRatio: '1:3',
        canvasWidth: 600,
        canvasHeight: 1800,
        printDpi: 300,
        printWidthMm: 51,
        printHeightMm: 152,
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      },
      // --- Strip 3 foto ---
      {
        name: 'Strip Standar',
        description: 'Strip 3 foto — lebar 6 cm x tinggi 15 cm, 300 DPI',
        layoutType: 'strip3',
        aspectRatio: '1:3',
        canvasWidth: 600,
        canvasHeight: 1800,
        printDpi: 300,
        printWidthMm: 51,
        printHeightMm: 152,
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      },
      // --- Single foto ---
      {
        name: '4R',
        description: 'Foto tunggal ukuran 4R (10x15 cm), 300 DPI',
        layoutType: 'single',
        aspectRatio: '2:3',
        canvasWidth: 1200,
        canvasHeight: 1800,
        printDpi: 300,
        printWidthMm: 102,
        printHeightMm: 152,
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      },
    ],
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
