
import { storage } from "./storage";
import bcrypt from "bcrypt";

export async function checkInitialSetup(): Promise<{
  needsSetup: boolean;
  hasUsers: boolean;
  hasSmtpConfig: boolean;
}> {
  try {
    // Prüfe ob Benutzer existieren
    const users = await storage.getAllUsers();
    const hasUsers = users.length > 0;

    // Prüfe ob SMTP-Konfiguration existiert
    const settings = await storage.getSystemSettings();
    const hasSmtpConfig = !!(
      settings?.smtpHost &&
      settings?.smtpUser &&
      settings?.smtpPassword
    );

    return {
      needsSetup: !hasUsers,
      hasUsers,
      hasSmtpConfig,
    };
  } catch (error) {
    console.error("Error checking initial setup:", error);
    return {
      needsSetup: true,
      hasUsers: false,
      hasSmtpConfig: false,
    };
  }
}

export async function createInitialAdmin(userData: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await storage.createUser({
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      role: "Admin",
    });

    console.log("✅ Initial admin user created:", user.name);
    return user;
  } catch (error) {
    console.error("❌ Error creating initial admin:", error);
    throw error;
  }
}

export async function configureSmtp(smtpData: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  appUrl: string;
}) {
  try {
    await storage.updateSystemSettings(smtpData);
    console.log("✅ SMTP settings configured");
    return true;
  } catch (error) {
    console.error("❌ Error configuring SMTP:", error);
    throw error;
  }
}
