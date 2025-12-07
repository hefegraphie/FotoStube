
import nodemailer from 'nodemailer';
import { storage } from './storage';

// Erstelle Transporter mit Einstellungen aus DB oder Umgebungsvariablen
async function createTransporter() {
  const settings = await storage.getSystemSettings();
  
  return nodemailer.createTransport({
    host: settings?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: settings?.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: settings?.smtpUser || process.env.SMTP_USER,
      pass: settings?.smtpPassword || process.env.SMTP_PASSWORD,
    },
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName: string
): Promise<boolean> {
  try {
    const settings = await storage.getSystemSettings();
    const transporter = await createTransporter();
    
    // Erstelle den Reset-Link
    const resetUrl = `${settings?.appUrl || process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: settings?.smtpFrom || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Passwort zurücksetzen',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Passwort zurücksetzen</h2>
          <p>Hallo ${userName},</p>
          <p>Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.</p>
          <p>Klicke auf den folgenden Link, um ein neues Passwort zu vergeben:</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Passwort zurücksetzen
            </a>
          </p>
          <p>Dieser Link ist 1 Stunde gültig.</p>
          <p>Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail einfach.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
            ${resetUrl}
          </p>
        </div>
      `,
      text: `
        Hallo ${userName},
        
        Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.
        
        Verwende den folgenden Link, um ein neues Passwort zu vergeben:
        ${resetUrl}
        
        Dieser Link ist 1 Stunde gültig.
        
        Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail einfach.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}
