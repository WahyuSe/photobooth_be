import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// Path to Google Service Account Key JSON
const KEY_FILE_PATH = path.join(__dirname, '../../google-credentials.json');

// Get folder ID and script URL from env
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SCRIPT_URL = process.env.GOOGLE_DRIVE_SCRIPT_URL; // Google Apps Script URL proxy

/**
 * Helper to check if credentials file exists
 */
function checkCredentialsExist(): boolean {
  return fs.existsSync(KEY_FILE_PATH);
}

/**
 * Uploads a base64 encoded image to the configured Google Drive folder.
 * Returns the webViewLink (viewable link) for the uploaded image.
 */
export async function uploadBase64ToDrive(base64Data: string, filename: string): Promise<string> {
  // If SCRIPT_URL is provided, we bypass the Service Account and use the Google Apps Script Web App proxy.
  // This completely solves the "Service Accounts do not have storage quota" error for personal @gmail.com accounts!
  if (SCRIPT_URL && SCRIPT_URL !== 'your_google_apps_script_web_app_url') {
    console.log(`📤 Mengunggah ${filename} menggunakan Google Apps Script proxy...`);
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          filename: filename,
          folderId: FOLDER_ID
        })
      });

      const data: any = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Gagal mengunggah file melalui Google Apps Script.');
      }

      console.log(`✅ File berhasil diunggah via Apps Script! URL: ${data.url}`);
      return data.url;
    } catch (error: any) {
      console.error('❌ Gagal mengunggah via Apps Script proxy:', error);
      throw new Error(`Gagal mengunggah via Google Apps Script: ${error.message || error}`);
    }
  }

  // Fallback to Service Account method
  if (!checkCredentialsExist()) {
    throw new Error(
      `File kredensial Google Drive tidak ditemukan di: ${KEY_FILE_PATH}. Silakan tambahkan file google-credentials.json terlebih dahulu.`
    );
  }

  // Set up authentication using the JSON credentials file
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Clean data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const cleanBase64 = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  const buffer = Buffer.from(cleanBase64, 'base64');

  // Convert buffer to readable stream for drive API
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  console.log(`📤 Mengunggah ${filename} ke Google Drive folder ID: ${FOLDER_ID} via Service Account...`);

  // Create file in Google Drive
  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: FOLDER_ID && FOLDER_ID !== 'your_shared_google_drive_folder_id' ? [FOLDER_ID] : [],
      mimeType: 'image/jpeg',
    },
    media: {
      mimeType: 'image/jpeg',
      body: stream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error('Gagal mengunggah file ke Google Drive (tidak ada ID file yang dikembalikan).');
  }

  console.log(`✅ File berhasil diunggah dengan ID: ${fileId}`);

  // Change permission so that anyone with the link can view/read it
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    console.log(`🔓 Izin akses publik untuk file ${fileId} telah diaktifkan.`);
  } catch (err) {
    console.warn(`⚠️ Gagal mengubah izin file menjadi publik:`, err);
  }

  return response.data.webViewLink || '';
}

