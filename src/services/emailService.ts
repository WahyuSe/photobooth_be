import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface SendPhotoEmailOptions {
  to: string;
  recipientName?: string;
  imageBase64: string;
  mimeType?: string;
}

export async function sendPhotoEmail(options: SendPhotoEmailOptions): Promise<void> {
  const { to, recipientName = 'Teman', imageBase64, mimeType = 'image/jpeg' } = options;

  const extension = mimeType.split('/')[1] || 'jpg';
  const filename = `photobooth-${Date.now()}.${extension}`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Foto Photobooth Anda</title>
  </head>
  <body style="margin:0; padding:0; background:#0f0f1a; font-family:'Segoe UI', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a; padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#c850c0,#4158d0); padding:32px; text-align:center;">
                <h1 style="color:#fff; margin:0; font-size:28px; letter-spacing:2px;">📸 PhotoBooth</h1>
                <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">Momen Indah Anda</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:40px 32px;">
                <p style="color:#c8c8e8; font-size:16px; margin:0 0 8px;">Halo, <strong style="color:#e0aaff;">${recipientName}</strong>! 👋</p>
                <p style="color:#9090b0; font-size:14px; margin:0 0 24px; line-height:1.6;">
                  Foto photobooth Anda sudah siap! Simpan dan bagikan momen spesial ini bersama orang-orang terkasih.
                </p>
                <!-- Photo -->
                <div style="text-align:center; margin:24px 0;">
                  <img src="cid:photo" alt="Foto Photobooth" style="max-width:100%; border-radius:12px; box-shadow:0 8px 32px rgba(200,80,192,0.3);" />
                </div>
                <p style="color:#9090b0; font-size:13px; margin:24px 0 0; text-align:center;">
                  Foto juga tersedia sebagai lampiran di email ini.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:rgba(255,255,255,0.03); padding:20px 32px; text-align:center; border-top:1px solid rgba(255,255,255,0.06);">
                <p style="color:#5050708; font-size:12px; margin:0; color:#606080;">
                  Dibuat dengan ❤️ menggunakan <strong style="color:#c850c0;">PhotoBooth App</strong>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"PhotoBooth App 📸" <no-reply@photobooth.app>',
    to,
    subject: '📸 Foto Photobooth Anda Sudah Siap!',
    html: htmlContent,
    attachments: [
      {
        filename,
        content: imageBase64,
        encoding: 'base64',
        cid: 'photo',
      },
    ],
  });
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
