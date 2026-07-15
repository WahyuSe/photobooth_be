-- CreateTable
CREATE TABLE "TemplateCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "photoCount" INTEGER NOT NULL,
    "thumbnail" TEXT,
    "frameColor" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "fonts" TEXT NOT NULL,
    "hasLogo" BOOLEAN NOT NULL DEFAULT true,
    "hasDate" BOOLEAN NOT NULL DEFAULT true,
    "hasFrame" BOOLEAN NOT NULL DEFAULT true,
    "frameWidth" INTEGER NOT NULL DEFAULT 20,
    "aspectRatio" TEXT NOT NULL DEFAULT '1:3',
    "overlayImage" TEXT,
    "slotsJson" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventConfig" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL DEFAULT 'My Event',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "quota" INTEGER NOT NULL DEFAULT 0,
    "usedQuota" INTEGER NOT NULL DEFAULT 0,
    "userSessionDuration" INTEGER NOT NULL DEFAULT 300,
    "page1Duration" INTEGER NOT NULL DEFAULT 30,
    "page2Duration" INTEGER NOT NULL DEFAULT 180,
    "page3Duration" INTEGER NOT NULL DEFAULT 60,
    "photoCountdown" INTEGER NOT NULL DEFAULT 5,
    "photoExpireDays" INTEGER NOT NULL DEFAULT 15,
    "enableGif" BOOLEAN NOT NULL DEFAULT true,
    "enableLivePhoto" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userName" TEXT,
    "sessionName" TEXT,
    "sessionCode" TEXT,
    "gridType" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drivePhotoUrl" TEXT,
    "driveGifUrl" TEXT,
    "driveLiveUrl" TEXT,
    "driveFolderId" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UITheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "colorPrimary" TEXT NOT NULL DEFAULT '#3B82F6',
    "colorPrimaryHover" TEXT NOT NULL DEFAULT '#2563EB',
    "colorSecondary" TEXT NOT NULL DEFAULT '#F3F4F6',
    "colorBackground" TEXT NOT NULL DEFAULT '#F9FAFB',
    "colorCard" TEXT NOT NULL DEFAULT '#FFFFFF',
    "colorText" TEXT NOT NULL DEFAULT '#111827',
    "colorTextMuted" TEXT NOT NULL DEFAULT '#6B7280',
    "colorBorder" TEXT NOT NULL DEFAULT '#E5E7EB',
    "colorError" TEXT NOT NULL DEFAULT '#EF4444',
    "colorSuccess" TEXT NOT NULL DEFAULT '#10B981',
    "fontHeading" TEXT NOT NULL DEFAULT '''Sora'', sans-serif',
    "fontBody" TEXT NOT NULL DEFAULT '''Plus Jakarta Sans'', sans-serif',
    "fontMono" TEXT NOT NULL DEFAULT '''Space Grotesk'', monospace',
    "radiusBase" TEXT NOT NULL DEFAULT '0.5rem',
    "radiusLg" TEXT NOT NULL DEFAULT '1rem',
    "radiusXl" TEXT NOT NULL DEFAULT '1.5rem',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UITheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasSize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layoutType" TEXT NOT NULL DEFAULT '*',
    "aspectRatio" TEXT NOT NULL DEFAULT '2:3',
    "canvasWidth" INTEGER NOT NULL DEFAULT 1200,
    "canvasHeight" INTEGER NOT NULL DEFAULT 1800,
    "printDpi" INTEGER NOT NULL DEFAULT 300,
    "printWidthMm" DOUBLE PRECISION,
    "printHeightMm" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionCode_key" ON "Session"("sessionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Session_accessToken_key" ON "Session"("accessToken");

-- CreateIndex
CREATE INDEX "CanvasSize_layoutType_idx" ON "CanvasSize"("layoutType");

-- CreateIndex
CREATE INDEX "CanvasSize_aspectRatio_idx" ON "CanvasSize"("aspectRatio");

-- CreateIndex
CREATE INDEX "CanvasSize_isActive_isDefault_idx" ON "CanvasSize"("isActive", "isDefault");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TemplateCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
