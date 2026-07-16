import { google } from "googleapis";
import { Readable } from "stream";
// import path from 'path';
// import fs from 'fs';

// Path to Google Service Account Key JSON
// const KEY_FILE_PATH = path.join(__dirname, '../../google-credentials.json');

// Get folder ID and script URL from env
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SCRIPT_URL = process.env.GOOGLE_DRIVE_SCRIPT_URL; // Google Apps Script URL proxy
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export type DriveUploadMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "video/webm"
  | "video/mp4";

/**
 * Helper to check if credentials file exists
 */
// function checkCredentialsExist(): boolean {
//   return fs.existsSync(KEY_FILE_PATH);
// }

function getDriveClient() {
  const credential = process.env.GOOGLE_CREDENTIAL;

  if (!credential) {
    throw new Error(
      "GOOGLE_CREDENTIAL belum dikonfigurasi di Environment Variables.",
    );
  }

  let credentials: any;

  try {
    credentials = JSON.parse(credential);
  } catch (error) {
    throw new Error(
      "GOOGLE_CREDENTIAL bukan JSON yang valid. Pastikan isi Environment Variable adalah JSON Service Account.",
    );
  }

  // Perbaiki newline pada private key
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({
    version: "v3",
    auth,
  });
}

function getConfiguredParentIds(): string[] {
  return FOLDER_ID && FOLDER_ID !== "your_shared_google_drive_folder_id"
    ? [FOLDER_ID]
    : [];
}

function cleanBase64Payload(base64Data: string): Buffer {
  const cleanBase64 = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;
  return Buffer.from(cleanBase64, "base64");
}

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function sanitizeDriveFolderName(name: string): string {
  return name.trim().replace(/[\\/]/g, "-").replace(/\s+/g, " ") || "Untitled";
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function hasAppsScriptProxy(): boolean {
  return Boolean(
    SCRIPT_URL && SCRIPT_URL !== "your_google_apps_script_web_app_url",
  );
}

function toDirectDriveLink(fileId: string): string {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

function extractDriveFileId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  const filePathMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  if (filePathMatch?.[1]) {
    return filePathMatch[1];
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get("id");
  } catch (_error) {
    return null;
  }
}

async function uploadFileViaAppsScript(
  base64Data: string,
  filename: string,
  mimeType: DriveUploadMimeType,
  folderId: string,
): Promise<{ fileId: string; webViewLink: string; directLink: string }> {
  if (!SCRIPT_URL) {
    throw new Error("GOOGLE_DRIVE_SCRIPT_URL belum dikonfigurasi.");
  }

  console.log(
    `📤 Mengunggah ${filename} ke folder ${folderId} via Google Apps Script proxy...`,
  );

  const scriptUrl = SCRIPT_URL as string;
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "uploadFile",
      imageBase64: base64Data,
      fileBase64: base64Data,
      base64Data,
      filename,
      folderId,
      mimeType,
    }),
  });

  const data: any = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
        data.error ||
        "Gagal mengunggah file melalui Google Apps Script.",
    );
  }

  const fileId =
    data.fileId ||
    data.id ||
    (typeof data.url === "string" ? extractDriveFileId(data.url) : null);
  const webViewLink =
    data.webViewLink ||
    data.url ||
    (fileId ? `https://drive.google.com/file/d/${fileId}/view` : "");
  const directLink =
    data.directLink ||
    data.webContentLink ||
    (fileId ? toDirectDriveLink(fileId) : webViewLink);

  if (!fileId && !webViewLink) {
    throw new Error(
      "Google Apps Script berhasil dipanggil, tetapi tidak mengembalikan fileId atau URL file.",
    );
  }

  return {
    fileId: fileId || "",
    webViewLink,
    directLink,
  };
}
async function getOrCreateFolderViaAppsScript(
  name: string,
  parentId?: string,
): Promise<string> {
  if (!SCRIPT_URL) {
    throw new Error("GOOGLE_DRIVE_SCRIPT_URL belum dikonfigurasi.");
  }

  const folderName = sanitizeDriveFolderName(name);
  const scriptUrl = SCRIPT_URL as string;
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getOrCreateFolder",
      folderName,
      name: folderName,
      parentFolderId: parentId || FOLDER_ID,
      parentId: parentId || FOLDER_ID,
      folderId: parentId || FOLDER_ID,
    }),
  });

  const data: any = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
        data.error ||
        "Google Apps Script belum support getOrCreateFolder.",
    );
  }

  const folderId = data.folderId || data.id;
  if (!folderId) {
    throw new Error("Google Apps Script tidak mengembalikan folderId.");
  }

  return folderId;
}
async function getOrCreateFolder(
  name: string,
  parentId?: string,
): Promise<string> {
  if (hasAppsScriptProxy()) {
    try {
      return await getOrCreateFolderViaAppsScript(name, parentId);
    } catch (error) {
      console.warn(
        "⚠️ Apps Script getOrCreateFolder gagal, fallback ke Service Account:",
        error,
      );
    }
  }

  const drive = getDriveClient();
  const folderName = sanitizeDriveFolderName(name);
  const queryParts = [
    `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
    `name='${escapeDriveQueryValue(folderName)}'`,
    "trashed=false",
  ];

  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const existing = await drive.files.list({
    q: queryParts.join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1,
  });

  const existingFolderId = existing.data.files?.[0]?.id;
  if (existingFolderId) {
    return existingFolderId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: parentId ? [parentId] : getConfiguredParentIds(),
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error(`Gagal membuat folder Google Drive: ${folderName}`);
  }

  return created.data.id;
}

/**
 * Membuat subfolder di dalam folder induk Google Drive.
 * Path: {GOOGLE_DRIVE_FOLDER_ID}/{sessionName}/{userCode}/
 */
export async function createSessionFolder(
  sessionName: string,
  userCode: string,
): Promise<string> {
  const configuredParents = getConfiguredParentIds();
  const rootFolderId = configuredParents[0];
  const eventFolderId = await getOrCreateFolder(sessionName, rootFolderId);
  return getOrCreateFolder(userCode, eventFolderId);
}

/**
 * Upload file (gambar, gif, video) ke folder tertentu di Drive.
 */
export async function uploadFileToDriveFolder(
  base64Data: string,
  filename: string,
  mimeType: DriveUploadMimeType,
  folderId: string,
): Promise<{ fileId: string; webViewLink: string; directLink: string }> {
  if (hasAppsScriptProxy()) {
    return uploadFileViaAppsScript(base64Data, filename, mimeType, folderId);
  }

  const drive = getDriveClient();
  const buffer = cleanBase64Payload(base64Data);

  console.log(
    `📤 Mengunggah ${filename} ke folder Google Drive: ${folderId} via Service Account...`,
  );

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: bufferToStream(buffer),
    },
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error(
      "Gagal mengunggah file ke Google Drive (tidak ada ID file yang dikembalikan).",
    );
  }

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  } catch (err) {
    console.warn(`⚠️ Gagal mengubah izin file menjadi publik:`, err);
  }

  return {
    fileId,
    webViewLink: response.data.webViewLink || "",
    directLink:
      response.data.webContentLink ||
      `https://drive.google.com/uc?id=${fileId}&export=download`,
  };
}

export async function getDriveFileMetadata(
  fileId: string,
): Promise<{ name?: string; mimeType?: string }> {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: "name, mimeType",
  });

  return {
    name: response.data.name || undefined,
    mimeType: response.data.mimeType || undefined,
  };
}

/**
 * Proxy stream file dari Drive ke client agar URL Google Drive tidak terekspose langsung.
 */
export async function streamFileFromDrive(fileId: string): Promise<Readable> {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" },
  );

  return response.data as Readable;
}

/**
 * Uploads a base64 encoded image to the configured Google Drive folder.
 * Returns the webViewLink (viewable link) for the uploaded image.
 */
export async function uploadBase64ToDrive(
  base64Data: string,
  filename: string,
): Promise<string> {
  // If SCRIPT_URL is provided, we bypass the Service Account and use the Google Apps Script Web App proxy.
  // This completely solves the "Service Accounts do not have storage quota" error for personal @gmail.com accounts!
  if (hasAppsScriptProxy()) {
    console.log(
      `📤 Mengunggah ${filename} menggunakan Google Apps Script proxy...`,
    );
    try {
      const scriptUrl = SCRIPT_URL as string;
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          filename: filename,
          folderId: FOLDER_ID,
          mimeType: "image/jpeg",
        }),
      });

      const data: any = await response.json();
      if (!data.success) {
        throw new Error(
          data.message || "Gagal mengunggah file melalui Google Apps Script.",
        );
      }

      console.log(
        `✅ File berhasil diunggah via Apps Script! URL: ${data.url}`,
      );
      return data.url;
    } catch (error: any) {
      console.error("❌ Gagal mengunggah via Apps Script proxy:", error);
      throw new Error(
        `Gagal mengunggah via Google Apps Script: ${error.message || error}`,
      );
    }
  }

  const folderId = getConfiguredParentIds()[0];
  if (folderId) {
    const uploaded = await uploadFileToDriveFolder(
      base64Data,
      filename,
      "image/jpeg",
      folderId,
    );
    return uploaded.webViewLink;
  }

  const drive = getDriveClient();
  const buffer = cleanBase64Payload(base64Data);

  console.log(
    `📤 Mengunggah ${filename} ke Google Drive root via Service Account...`,
  );

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [],
      mimeType: "image/jpeg",
    },
    media: {
      mimeType: "image/jpeg",
      body: bufferToStream(buffer),
    },
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error(
      "Gagal mengunggah file ke Google Drive (tidak ada ID file yang dikembalikan).",
    );
  }

  console.log(`✅ File berhasil diunggah dengan ID: ${fileId}`);

  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    console.log(`🔓 Izin akses publik untuk file ${fileId} telah diaktifkan.`);
  } catch (err) {
    console.warn(`⚠️ Gagal mengubah izin file menjadi publik:`, err);
  }

  return response.data.webViewLink || "";
}
