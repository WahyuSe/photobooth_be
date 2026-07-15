import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import prisma from "../prisma";

const router = Router();
const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;
const settingsFilePath = isVercel
  ? "/tmp/settings.json"
  : path.join(__dirname, "../../settings.json");

router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (password === adminPassword) {
    // Return a simple token (in a real app, use JWT)
    return res.json({ success: true, token: "admin-auth-token-valid" });
  }

  return res.status(401).json({ success: false, message: "Password salah" });
});

// GET /api/admin/settings - Read system settings
router.get("/settings", (_req: Request, res: Response): any => {
  try {
    if (!fs.existsSync(settingsFilePath)) {
      return res.json({ success: true, data: { whatsappEnabled: false } });
    }
    const rawData = fs.readFileSync(settingsFilePath, "utf8");
    const settings = JSON.parse(rawData);
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal membaca pengaturan." });
  }
});

// POST /api/admin/settings - Update system settings
router.post("/settings", (req: Request, res: Response): any => {
  try {
    const newSettings = req.body;
    let currentSettings = { whatsappEnabled: false };

    if (fs.existsSync(settingsFilePath)) {
      try {
        const rawData = fs.readFileSync(settingsFilePath, "utf8");
        currentSettings = JSON.parse(rawData);
      } catch (e) {
        console.error(e);
      }
    }

    const updatedSettings = {
      ...currentSettings,
      ...newSettings,
    };

    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify(updatedSettings, null, 2),
      "utf8",
    );
    return res.json({
      success: true,
      message: "Pengaturan berhasil diperbarui.",
      data: updatedSettings,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal memperbarui pengaturan." });
  }
});

// --- EVENT CONFIG ADMIN ---

// GET /api/admin/event/config
router.get("/event/config", async (_req: Request, res: Response) => {
  try {
    const config = await prisma.eventConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/event/config
router.post("/event/config", async (req: Request, res: Response) => {
  try {
    const { isNew, ...data } = req.body;

    // Parse dates if provided as strings
    if (data.startDate) {
      if (
        typeof data.startDate === "string" &&
        !data.startDate.includes("Z") &&
        !data.startDate.includes("+") &&
        !data.startDate.includes("-")
      ) {
        data.startDate = new Date(data.startDate + "+08:00");
      } else {
        data.startDate = new Date(data.startDate);
      }
    }
    if (data.endDate) {
      if (
        typeof data.endDate === "string" &&
        !data.endDate.includes("Z") &&
        !data.endDate.includes("+") &&
        !data.endDate.includes("-")
      ) {
        data.endDate = new Date(data.endDate + "+08:00");
      } else {
        data.endDate = new Date(data.endDate);
      }
    }

    if (data.photoExpireDays !== undefined) {
      const parsedExpireDays = Number(data.photoExpireDays);
      if (!Number.isInteger(parsedExpireDays) || parsedExpireDays < 1) {
        return res
          .status(400)
          .json({ success: false, message: "Masa berlaku link minimal 1 hari" });
      }
      data.photoExpireDays = parsedExpireDays;
    }

    if (data.enableGif !== undefined) {
      data.enableGif = data.enableGif === true || data.enableGif === "true";
    }

    if (data.enableLivePhoto !== undefined) {
      data.enableLivePhoto = data.enableLivePhoto === true || data.enableLivePhoto === "true";
    }

    let updatedConfig;

    if (isNew) {
      // Nonaktifkan semua event config yang lama
      await prisma.eventConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // Buat event config baru (usedQuota otomatis 0)
      updatedConfig = await prisma.eventConfig.create({
        data: { ...data, usedQuota: 0, isActive: true },
      });
    } else {
      // Update config yang sedang aktif
      const config = await prisma.eventConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });

      if (config) {
        updatedConfig = await prisma.eventConfig.update({
          where: { id: config.id },
          data,
        });
      } else {
        updatedConfig = await prisma.eventConfig.create({
          data: { ...data, usedQuota: 0, isActive: true },
        });
      }
    }
    return res.json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal update event config" });
  }
});

// --- TEMPLATE CATEGORIES ADMIN ---

// GET /api/admin/categories
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.templateCategory.findMany();
    return res.json({ success: true, data: categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/categories
router.post("/categories", async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.templateCategory.create({
      data: { name, description },
    });
    return res.json({ success: true, data: category });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Gagal buat kategori" });
  }
});

// PUT /api/admin/categories/:id
router.put("/categories/:id", async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.templateCategory.update({
      where: { id: req.params.id as string },
      data: { name, description },
    });
    return res.json({ success: true, data: category });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Gagal update kategori" });
  }
});

// DELETE /api/admin/categories/:id
router.delete("/categories/:id", async (req: Request, res: Response) => {
  try {
    await prisma.templateCategory.delete({
      where: { id: req.params.id as string },
    });
    return res.json({ success: true, message: "Kategori dihapus" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Gagal hapus kategori" });
  }
});

// --- UI THEME ADMIN ---

// GET /api/admin/theme - Daftar semua tema
router.get("/theme", async (_req: Request, res: Response): Promise<any> => {
  try {
    const themes = await prisma.uITheme.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: themes });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal mengambil daftar tema" });
  }
});

// POST /api/admin/theme - Buat tema baru
router.post("/theme", async (req: Request, res: Response): Promise<any> => {
  try {
    const data = req.body;
    const theme = await prisma.uITheme.create({ data });
    return res.json({ success: true, data: theme });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal membuat tema baru" });
  }
});

// PUT /api/admin/theme/:id - Update tema
router.put("/theme/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const data = req.body;
    const theme = await prisma.uITheme.update({
      where: { id },
      data,
    });
    return res.json({ success: true, data: theme });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal mengupdate tema" });
  }
});

// DELETE /api/admin/theme/:id - Hapus tema
router.delete(
  "/theme/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const id = req.params.id as string;
      await prisma.uITheme.delete({ where: { id } });
      return res.json({ success: true, message: "Tema berhasil dihapus" });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Gagal menghapus tema" });
    }
  },
);

// POST /api/admin/theme/:id/activate - Aktifkan tema (nonaktifkan yang lain)
router.post(
  "/theme/:id/activate",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const id = req.params.id as string;

      // Nonaktifkan semua tema
      await prisma.uITheme.updateMany({ data: { isActive: false } });

      // Aktifkan tema yang dipilih
      const theme = await prisma.uITheme.update({
        where: { id },
        data: { isActive: true },
      });

      return res.json({ success: true, data: theme });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Gagal mengaktifkan tema" });
    }
  },
);

// --- CANVAS SIZE ADMIN ---

class BadRequestError extends Error {}

const parseCanvasSizeBoolean = (value: unknown): boolean => {
  return value === true || value === "true" || value === "1";
};

const normalizeCanvasSizeString = (field: string, value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(`${field} harus berupa teks dan tidak boleh kosong`);
  }
  return value.trim();
};

const normalizeCanvasSizeInteger = (field: string, value: unknown, min?: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (min !== undefined && parsed < min)) {
    throw new BadRequestError(`${field} harus berupa angka bulat${min !== undefined ? ` minimal ${min}` : ""}`);
  }
  return parsed;
};

const normalizeCanvasSizeFloat = (field: string, value: unknown): number | null => {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError(`${field} harus berupa angka lebih dari 0`);
  }
  return parsed;
};

const normalizeCanvasSizePayload = (body: Record<string, unknown>, isCreate: boolean) => {
  const data: any = {};

  if (body.name !== undefined) {
    data.name = normalizeCanvasSizeString("name", body.name);
  } else if (isCreate) {
    throw new BadRequestError("name wajib diisi");
  }

  if (body.description !== undefined) {
    data.description = body.description === null || body.description === "" ? null : normalizeCanvasSizeString("description", body.description);
  }

  if (body.layoutType !== undefined) {
    data.layoutType = normalizeCanvasSizeString("layoutType", body.layoutType);
  }

  if (body.aspectRatio !== undefined) {
    data.aspectRatio = normalizeCanvasSizeString("aspectRatio", body.aspectRatio);
  }

  if (body.canvasWidth !== undefined) {
    data.canvasWidth = normalizeCanvasSizeInteger("canvasWidth", body.canvasWidth, 1);
  }

  if (body.canvasHeight !== undefined) {
    data.canvasHeight = normalizeCanvasSizeInteger("canvasHeight", body.canvasHeight, 1);
  }

  if (body.printDpi !== undefined) {
    data.printDpi = normalizeCanvasSizeInteger("printDpi", body.printDpi, 1);
  }

  if (body.printWidthMm !== undefined) {
    data.printWidthMm = normalizeCanvasSizeFloat("printWidthMm", body.printWidthMm);
  }

  if (body.printHeightMm !== undefined) {
    data.printHeightMm = normalizeCanvasSizeFloat("printHeightMm", body.printHeightMm);
  }

  if (body.isActive !== undefined) {
    data.isActive = parseCanvasSizeBoolean(body.isActive);
  }

  if (body.isDefault !== undefined) {
    data.isDefault = parseCanvasSizeBoolean(body.isDefault);
  }

  if (body.sortOrder !== undefined) {
    data.sortOrder = normalizeCanvasSizeInteger("sortOrder", body.sortOrder);
  }

  return data;
};

const handleCanvasSizeError = (res: Response, error: any, fallbackMessage: string) => {
  console.error(error);

  if (error instanceof BadRequestError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error?.code === "P2025") {
    return res.status(404).json({ success: false, message: "Preset ukuran canvas tidak ditemukan" });
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
};

// GET /api/admin/canvas-sizes
router.get("/canvas-sizes", async (req: Request, res: Response): Promise<any> => {
  try {
    const layoutType = typeof req.query.layoutType === "string" ? req.query.layoutType : undefined;
    const isActive = req.query.active !== undefined ? parseCanvasSizeBoolean(req.query.active) : undefined;

    const presets = await prisma.canvasSize.findMany({
      where: {
        ...(layoutType ? { layoutType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: [
        { layoutType: "asc" },
        { isDefault: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return res.json({ success: true, data: presets });
  } catch (error) {
    return handleCanvasSizeError(res, error, "Gagal mengambil preset ukuran canvas");
  }
});

// POST /api/admin/canvas-sizes
router.post("/canvas-sizes", async (req: Request, res: Response): Promise<any> => {
  try {
    const data = normalizeCanvasSizePayload(req.body, true);

    const preset = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.canvasSize.updateMany({
          where: { layoutType: data.layoutType ?? "*" },
          data: { isDefault: false },
        });
      }

      return tx.canvasSize.create({ data });
    });

    return res.json({ success: true, data: preset });
  } catch (error) {
    return handleCanvasSizeError(res, error, "Gagal membuat preset ukuran canvas");
  }
});

// PUT /api/admin/canvas-sizes/:id
router.put("/canvas-sizes/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const data = normalizeCanvasSizePayload(req.body, false);

    const preset = await prisma.$transaction(async (tx) => {
      const current = await tx.canvasSize.findUnique({ where: { id } });
      if (!current) {
        throw Object.assign(new Error("Preset ukuran canvas tidak ditemukan"), { code: "P2025" });
      }

      const nextLayoutType = data.layoutType ?? current.layoutType;
      if (data.isDefault === true) {
        await tx.canvasSize.updateMany({
          where: { layoutType: nextLayoutType, id: { not: id } },
          data: { isDefault: false },
        });
        data.isActive = true;
      }

      return tx.canvasSize.update({
        where: { id },
        data,
      });
    });

    return res.json({ success: true, data: preset });
  } catch (error) {
    return handleCanvasSizeError(res, error, "Gagal mengupdate preset ukuran canvas");
  }
});

// POST /api/admin/canvas-sizes/:id/default
router.post("/canvas-sizes/:id/default", async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;

    const preset = await prisma.$transaction(async (tx) => {
      const current = await tx.canvasSize.findUnique({ where: { id } });
      if (!current) {
        throw Object.assign(new Error("Preset ukuran canvas tidak ditemukan"), { code: "P2025" });
      }

      await tx.canvasSize.updateMany({
        where: { layoutType: current.layoutType, id: { not: id } },
        data: { isDefault: false },
      });

      return tx.canvasSize.update({
        where: { id },
        data: { isDefault: true, isActive: true },
      });
    });

    return res.json({ success: true, data: preset });
  } catch (error) {
    return handleCanvasSizeError(res, error, "Gagal mengatur preset default" );
  }
});

// DELETE /api/admin/canvas-sizes/:id
router.delete("/canvas-sizes/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    await prisma.canvasSize.delete({
      where: { id: req.params.id as string },
    });

    return res.json({ success: true, message: "Preset ukuran canvas dihapus" });
  } catch (error) {
    return handleCanvasSizeError(res, error, "Gagal menghapus preset ukuran canvas");
  }
});

export default router;
