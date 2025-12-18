import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertGallerySchema,
  insertPhotoSchema,
  insertPhotoLikeSchema,
  insertCommentSchema,
  insertNotificationSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import archiver from "archiver";
import { ThumbnailGenerator } from "./thumbnailGenerator";
import {
  galleries,
  photos,
  users,
  comments,
  photoLikes,
  notifications,
  galleryAssignments,
  brandingSettings,
} from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { authenticateJWT, requireAdmin, requireAdminOrCreator } from "./auth";
import { db } from "./storage";
import { sendPasswordResetEmail } from "./mailer";
import crypto from "crypto";
import { checkInitialSetup, createInitialAdmin, configureSmtp } from "./setup";

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const dirs = ["uploads", "uploads/photos", "uploads/galleries"];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Configure multer for photo uploads
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirs();
    const galleryId = req.params.galleryId || "default";
    const uploadPath = `uploads/galleries/${galleryId}`;

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueId = randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Nur Bilddateien sind erlaubt (JPEG, PNG, GIF, WebP)"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Setup status route (public)
  app.get("/api/setup/status", async (req, res) => {
    try {
      const status = await checkInitialSetup();
      res.json(status);
    } catch (error) {
      console.error("Error checking setup status:", error);
      res.status(500).json({ error: "Fehler beim Prüfen des Setup-Status" });
    }
  });

  // Initial admin creation route (public, only if no users exist)
  app.post("/api/setup/create-admin", async (req, res) => {
    try {
      const status = await checkInitialSetup();
      
      if (status.hasUsers) {
        return res.status(403).json({ error: "Setup bereits abgeschlossen" });
      }

      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Alle Felder sind erforderlich" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
      }

      const user = await createInitialAdmin({ name, email, password });
      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Error creating initial admin:", error);
      res.status(500).json({ error: "Fehler beim Erstellen des Admin-Benutzers" });
    }
  });

  // SMTP configuration route (public, only during initial setup)
  app.post("/api/setup/configure-smtp", async (req, res) => {
    try {
      const status = await checkInitialSetup();
      
      // Allow SMTP configuration even if users exist but SMTP is not configured
      if (status.hasSmtpConfig && !req.user?.role) {
        return res.status(403).json({ error: "SMTP bereits konfiguriert" });
      }

      const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, appUrl } = req.body;

      // Allow skipping SMTP configuration
      if (!smtpHost && !smtpUser) {
        return res.json({ 
          skipped: true, 
          message: "SMTP-Konfiguration übersprungen" 
        });
      }

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom || !appUrl) {
        return res.status(400).json({ error: "Alle SMTP-Felder sind erforderlich" });
      }

      await configureSmtp({
        smtpHost,
        smtpPort: parseInt(smtpPort),
        smtpUser,
        smtpPassword,
        smtpFrom,
        appUrl,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error configuring SMTP:", error);
      res.status(500).json({ error: "Fehler beim Konfigurieren von SMTP" });
    }
  });

  // System Settings Routes
  app.get("/api/system-settings", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  app.post("/api/system-settings", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, appUrl } = req.body;

      await storage.updateSystemSettings({
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpFrom,
        appUrl,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).json({ error: "Failed to update system settings" });
    }
  });

  // Branding Settings Routes
  app.get("/api/branding", async (req, res) => {
    try {
      const settings = await db.query.brandingSettings.findFirst();
      res.json(settings || { companyName: "PhotoGallery" });
    } catch (error) {
      console.error("Error fetching branding settings:", error);
      res.status(500).json({ error: "Failed to fetch branding settings" });
    }
  });

  app.post("/api/branding", authenticateJWT, async (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Nicht angemeldet" });
    }

    const user = req.user as { userId: string; role: string };
    if (user.role !== "Admin") {
      return res.status(403).json({ error: "Keine Berechtigung" });
    }

    try {
      const { companyName } = req.body;

      const existingSettings = await db.query.brandingSettings.findFirst();

      if (existingSettings) {
        await db
          .update(brandingSettings)
          .set({ companyName, updatedAt: new Date() })
          .where(eq(brandingSettings.id, existingSettings.id));
      } else {
        await db.insert(brandingSettings).values({ companyName });
      }

      res.json({ success: true, companyName });
    } catch (error) {
      console.error("Error updating branding settings:", error);
      res.status(500).json({ error: "Failed to update branding settings" });
    }
  });


  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { name, password } = req.body;

      if (!name || !password) {
        return res
          .status(400)
          .json({ error: "Name/E-Mail und Passwort sind erforderlich" });
      }

      // Try to find user by name or email
      let user = await storage.getUserByName(name);

      // If not found by name, try email
      if (!user && name.includes('@')) {
        user = await storage.getUserByEmail(name.toLowerCase());
      }

      if (!user) {
        return res.status(401).json({ error: "Ungültige Anmeldedaten" });
      }

      // Use bcrypt to compare password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Ungültige Anmeldedaten" });
      }

      // Generate JWT token
      const { generateToken } = await import("./auth");
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Set HTTP-only cookie
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
      });

      // Don't send password back to client
      const { password: _, ...userWithoutPassword } = user;
      res.json({
        user: userWithoutPassword,
        token, // Optional: auch als JSON zurückgeben für localStorage-Fallback
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Anmeldefehler" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("authToken");
    res.json({ success: true });
  });

  // Change password endpoint
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;

      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: "Alle Felder sind erforderlich" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: "Aktuelles Passwort ist falsch" });
      }

      // Hash new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Fehler beim Ändern des Passworts" });
    }
  });

  // Change name endpoint
  app.post("/api/auth/change-name", authenticateJWT, async (req, res) => {
    const { userId, newName } = req.body;

    if (!userId || !newName) {
      return res.status(400).json({ error: "Fehlende Daten" });
    }

    // Check if name is already taken
    const existingUser = await storage.getUserByName(newName);
    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({ error: "Name wird bereits verwendet" });
    }

    await storage.updateUserName(userId, newName);
    res.json({ message: "Name erfolgreich geändert" });
  });

  // Forgot password endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "E-Mail ist erforderlich" });
      }

      // Find user by email (case-insensitive)
      const user = await storage.getUserByEmail(email.toLowerCase());
      
      // Aus Sicherheitsgründen immer erfolgreiche Antwort zurückgeben,
      // auch wenn die E-Mail nicht existiert (verhindert E-Mail-Enumeration)
      if (!user) {
        return res.json({ 
          message: "Falls diese E-Mail registriert ist, wurde ein Reset-Link gesendet" 
        });
      }

      // Generiere einen sicheren, zufälligen Token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Token ist 1 Stunde gültig
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Speichere den Token in der Datenbank
      await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

      // Sende die E-Mail
      const emailSent = await sendPasswordResetEmail(user.email, resetToken, user.name);

      if (!emailSent) {
        console.error('Failed to send password reset email to:', user.email);
        // Trotzdem erfolgreiche Antwort (aus Sicherheitsgründen)
      }

      res.json({ 
        message: "Falls diese E-Mail registriert ist, wurde ein Reset-Link gesendet" 
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Fehler beim Senden des Reset-Links" });
    }
  });

  // Reset password with token endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token und neues Passwort sind erforderlich" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
      }

      // Suche den Token in der Datenbank
      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(400).json({ error: "Ungültiger oder abgelaufener Reset-Link" });
      }

      // Prüfe, ob der Token abgelaufen ist
      if (new Date() > new Date(resetToken.expiresAt)) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ error: "Reset-Link ist abgelaufen" });
      }

      // Hash das neue Passwort
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update das Passwort
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Lösche den verwendeten Token
      await storage.deletePasswordResetToken(token);

      res.json({ message: "Passwort erfolgreich geändert" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Fehler beim Zurücksetzen des Passworts" });
    }
  });

  // Get all users (for assignment selection)
  app.get(
    "/api/users",
    authenticateJWT,
    requireAdmin,
    async (req: any, res) => {
      try {
        const allUsers = await storage.getAllUsers();
        // Don't send passwords
        const usersWithoutPasswords = allUsers.map(
          ({ password: _, ...user }) => user,
        );
        res.json(usersWithoutPasswords);
      } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ error: "Fehler beim Laden der Benutzer" });
      }
    },
  );

  // Create user (Admin only)
  app.post("/api/users", authenticateJWT, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, E-Mail und Passwort sind erforderlich" });
    }

    const existingUser = await storage.getUserByName(name);
    if (existingUser) {
      return res.status(400).json({ error: "Name wird bereits verwendet" });
    }

    const existingEmail = await storage.getUserByEmail(email.toLowerCase());
    if (existingEmail) {
      return res.status(400).json({ error: "E-Mail wird bereits verwendet" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "User",
    });

    // Omit password from response
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  });

  // Update user (Admin only)
  app.put("/api/users/:id", authenticateJWT, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    // Trim all string fields
    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPassword = password?.trim();

    // Check if name is already taken by another user
    if (trimmedName && trimmedName !== user.name) {
      const existingUser = await storage.getUserByName(trimmedName);
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: "Name wird bereits verwendet" });
      }
    }

    // Check if email is already taken by another user
    if (trimmedEmail && trimmedEmail !== user.email) {
      const existingEmail = await storage.getUserByEmail(trimmedEmail);
      if (existingEmail && existingEmail.id !== id) {
        return res.status(400).json({ error: "E-Mail wird bereits verwendet" });
      }
    }

    const updates: any = {};
    if (trimmedName) updates.name = trimmedName;
    if (trimmedEmail) updates.email = trimmedEmail;
    if (role) updates.role = role;

    // Only hash and update password if it's provided AND not empty
    if (trimmedPassword && trimmedPassword.length > 0) {
      if (trimmedPassword.length < 6) {
        return res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
      }
      updates.password = await bcrypt.hash(trimmedPassword, 10);
    }

    // Only update if there are actual changes
    if (Object.keys(updates).length > 0) {
      await storage.updateUser(id, updates);
    }

    res.status(200).json({ message: "Benutzer erfolgreich aktualisiert" });
  });

    // Delete user (Admin only)
  app.delete("/api/users/:id", authenticateJWT, requireAdmin, async (req, res) => {
    const { id } = req.params;

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    // Delete user and all associated gallery assignments
    await storage.deleteUser(id);
    res.json({ message: "Benutzer erfolgreich gelöscht" });
  });


  // User registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Normalize email to lowercase
      userData.email = userData.email.toLowerCase();

      // Check if user already exists by email (case-insensitive)
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return res.status(409).json({ error: "Benutzer mit dieser E-Mail existiert bereits" });
      }

      // Check if username already exists
      const existingUserByName = await storage.getUserByName(userData.name);
      if (existingUserByName) {
        return res.status(409).json({ error: "Benutzername bereits vergeben" });
      }

      const user = await storage.createUser(userData);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Ungültige Benutzerdaten", details: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registrierungsfehler" });
    }
  });

  // Public sub-galleries route (no auth required)
  app.get("/api/gallery/:galleryId/sub-galleries/public", async (req, res) => {
    try {
      const { galleryId } = req.params;

      // Get parent gallery info
      const parentGallery = await storage.getGallery(galleryId);
      if (!parentGallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }

      // Check if parent gallery has password protection
      if (parentGallery.password) {
        return res.status(403).json({ error: "Galerie ist passwortgeschützt" });
      }

      // Get sub-galleries
      const subGalleries = await storage.getSubGalleriesByParentId(galleryId);

      // Add photo count for each sub-gallery
      const subGalleriesWithPhotoCounts = await Promise.all(
        subGalleries.map(async (gallery) => {
          const photos = await storage.getPhotosByGalleryId(gallery.id);
          return {
            ...gallery,
            photoCount: photos.length,
            lastModified: gallery.createdAt,
          };
        }),
      );

      res.json(subGalleriesWithPhotoCounts);
    } catch (error) {
      console.error("Get public sub-galleries error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Sub-Galerien" });
    }
  });

  // Public gallery route (no auth required)
  app.get("/api/gallery/:galleryId/public", async (req, res) => {
    try {
      const { galleryId } = req.params;

      // Get gallery info
      const gallery = await storage.getGallery(galleryId);
      if (!gallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }

      // For sub-galleries, check parent gallery password
      let effectivePassword = gallery.password;
      if (gallery.parentId) {
        const parentGallery = await storage.getGallery(gallery.parentId);
        effectivePassword = parentGallery?.password || null;
      }

      // Check if gallery has password protection
      if (effectivePassword) {
        return res.status(403).json({ error: "Galerie ist passwortgeschützt" });
      }

      console.log("Public gallery data:", { galleryId, gallery });

      // Get photos with full data (likes, comments, ratings)
      const photos = await storage.getPhotosWithData(galleryId);

      res.json({
        gallery,
        photos,
      });
    } catch (error) {
      console.error("Get public gallery error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Galerie" });
    }
  });

  // Public gallery route with password check
  app.post("/api/gallery/:galleryId/public", async (req, res) => {
    try {
      const { galleryId } = req.params;
      const { password } = req.body;

      // Get gallery info
      const gallery = await storage.getGallery(galleryId);
      if (!gallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }

      // For sub-galleries, check parent gallery password
      let effectivePassword = gallery.password;
      if (gallery.parentId) {
        const parentGallery = await storage.getGallery(gallery.parentId);
        effectivePassword = parentGallery?.password || null;
      }

      // Check password if gallery is protected
      if (effectivePassword) {
        const isValidPassword = await bcrypt.compare(
          password,
          effectivePassword,
        );
        if (!isValidPassword) {
          return res.status(401).json({ error: "Falsches Passwort" });
        }
      }

      console.log("Public gallery data:", { galleryId, gallery });

      // Get photos with full data (likes, comments, ratings)
      const photos = await storage.getPhotosWithData(galleryId);

      res.json({
        gallery,
        photos,
      });
    } catch (error) {
      console.error("Get public gallery with password error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Galerie" });
    }
  });

  // Public batch rating endpoint (no auth required) - MUST be before parametrized route
  app.post("/api/public/photos/batch/rating", async (req, res) => {
    try {
      const { photoIds, rating, userName } = req.body;

      if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: "Photo-IDs sind erforderlich" });
      }

      if (typeof rating !== "number" || rating < 0 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating muss zwischen 0 und 5 sein" });
      }

      await storage.setPhotosRating(photoIds, rating);

      // Get updated photos data
      const updatedPhotos = [];
      for (const photoId of photoIds) {
        const photo = await storage.getPhoto(photoId);
        if (photo) {
          updatedPhotos.push({
            id: photo.id,
            rating: photo.rating || 0,
          });
        }
      }

      // Create batch notification if multiple photos are rated
      if (photoIds.length > 1) {
        const firstPhoto = await storage.getPhoto(photoIds[0]);
        const gallery = firstPhoto
          ? await storage.getGallery(firstPhoto.galleryId)
          : null;

        if (firstPhoto && gallery?.userId) {
          const firstPhotoName = firstPhoto.alt || firstPhoto.filename;
          const otherCount = photoIds.length - 1;
          const starText = rating === 1 ? "Stern" : "Sterne";
          const actorName = userName || "Anonymer Besucher";
          const actorText = userName || "Jemand";

          const message = `${actorText} hat Bild "${firstPhotoName}" und ${otherCount} weitere mit ${rating} ${starText} bewertet`;

          storage
            .createNotification({
              userId: gallery.userId,
              galleryId: gallery.id,
              photoId: firstPhoto.id,
              type: "rating",
              message,
              actorName,
              isRead: false,
            })
            .catch((error) =>
              console.error("Error creating batch notification:", error),
            );
        }
      }

      res.json({
        success: true,
        message: `${photoIds.length} Fotos bewertet`,
        photos: updatedPhotos,
      });
    } catch (error) {
      console.error("Public batch rating error:", error);
      res.status(500).json({ error: "Fehler beim Setzen der Bewertungen" });
    }
  });

  // Public rating endpoint (no auth required)
  app.post("/api/public/photos/:photoId/rating", async (req, res) => {
    try {
      const { photoId } = req.params;
      const { rating, userName } = req.body;

      if (typeof rating !== "number" || rating < 0 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating muss zwischen 0 und 5 sein" });
      }

      const success = await storage.setPhotoRating(photoId, rating);
      if (!success) {
        return res.status(404).json({ error: "Foto nicht gefunden" });
      }

      // Get updated photo data
      const updatedPhoto = await storage.getPhoto(photoId);
      if (!updatedPhoto) {
        return res.status(404).json({ error: "Foto nicht gefunden" });
      }

      // Create notification asynchronously
      const gallery = await storage.getGallery(updatedPhoto.galleryId);

      if (gallery?.userId) {
        const actorName = userName || "Anonymer Besucher";
        const actorText = userName || "Jemand";
        const message = `${actorText} hat Bild "${updatedPhoto.alt}" in Galerie "${gallery.name}" mit ${rating} Stern${rating !== 1 ? "en" : ""} bewertet`;

        storage
          .createNotification({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId,
            type: "rating",
            message,
            actorName,
            isRead: false,
          })
          .catch((error) =>
            console.error("Error creating notification:", error),
          );
      }

      res.json({
        success: true,
        photo: {
          id: updatedPhoto.id,
          rating: updatedPhoto.rating || 0,
        },
      });
    } catch (error) {
      console.error("Public rating error:", error);
      res.status(500).json({ error: "Fehler beim Setzen der Bewertung" });
    }
  });

  // Public like endpoint (no auth required)
  app.post("/api/public/photos/:photoId/like", async (req, res) => {
    try {
      const { isLiked, userName } = req.body;
      const { photoId } = req.params;

      if (typeof isLiked !== "boolean") {
        return res
          .status(400)
          .json({ error: "isLiked muss ein Boolean sein" });
      }

      const like = await storage.togglePhotoLike(photoId, isLiked);

      // Get updated like status
      const allLikes = await storage.getAllPhotoLikes(photoId);
      const likeCount = allLikes.filter((like) => like.isLiked).length;
      const dislikeCount = allLikes.filter((like) => !like.isLiked).length;
      const currentStatus = likeCount > dislikeCount;

      // Create notification asynchronously
      const photo = await storage.getPhoto(photoId);
      const gallery = photo
        ? await storage.getGallery(photo.galleryId)
        : null;

      if (photo && gallery?.userId) {
        const action = isLiked ? "geliked" : "entliked";
        const actorName = userName || "Anonymer Besucher";
        const actorText = userName || "Jemand";
        const message = `${actorText} hat Bild "${photo.alt}" in Galerie "${gallery.name}" ${action}`;

        storage
          .createNotification({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId,
            type: "like",
            message,
            actorName,
            isRead: false,
          })
          .catch((error) =>
            console.error("Error creating notification:", error),
          );
      }

      res.json({
        success: true,
        photo: {
          id: photoId,
          isLiked: currentStatus,
          likeCount: likeCount,
        },
      });
    } catch (error) {
      console.error("Public like error:", error);
      res.status(500).json({ error: "Fehler beim Speichern des Likes" });
    }
  });

  // Public comment endpoint (no auth required)
  app.post("/api/public/photos/:photoId/comments", async (req, res) => {
    try {
      const { commenterName, text } = req.body;
      const { photoId } = req.params;

      if (!commenterName || !text) {
        return res
          .status(400)
          .json({ error: "Name und Text sind erforderlich" });
      }

      const commentId = await storage.addComment(
        photoId,
        commenterName,
        text,
      );

      // Create comment notification for gallery owner
      try {
        const photo = await storage.getPhoto(photoId);
        const gallery = photo
          ? await storage.getGallery(photo.galleryId)
          : null;

        if (photo && gallery?.userId) {
          const message = `${commenterName} hat einen Kommentar zu Bild "${photo.alt}" in Galerie "${gallery.name}" hinterlassen`;

          const notification = await storage.createNotification({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId,
            type: "comment",
            message,
            actorName: commenterName,
            isRead: false,
          });
        }
      } catch (notificationError) {
        console.error(
          "Error creating comment notification:",
          notificationError,
        );
      }

      res.status(201).json({ success: true, commentId });
    } catch (error) {
      console.error("Public comment error:", error);
      res.status(500).json({ error: "Fehler beim Erstellen des Kommentars" });
    }
  });

  // Gallery routes
  app.get("/api/galleries", authenticateJWT, async (req: any, res) => {
    try {
      const userId = req.user.userId; // Get userId from JWT token
      
      // Get galleries owned by user
      const ownedGalleries = await storage.getMainGalleriesByUserId(userId);
      
      // Get galleries assigned to user
      const assignedGalleries = await storage.getUserAssignedGalleries(userId);
      
      // Filter assigned galleries to only include main galleries (no parent)
      const assignedMainGalleries = assignedGalleries.filter(g => !g.parentId);
      
      // Merge and deduplicate galleries
      const allGalleriesMap = new Map();
      [...ownedGalleries, ...assignedMainGalleries].forEach(gallery => {
        allGalleriesMap.set(gallery.id, gallery);
      });
      
      const galleriesData = Array.from(allGalleriesMap.values());

      // Add photo count and last modified date for each gallery
      const galleriesWithDetails = await Promise.all(
        galleriesData.map(async (gallery) => {
          const photos = await storage.getPhotosByGalleryId(gallery.id);
          return {
            ...gallery,
            photoCount: photos.length,
            lastModified: gallery.createdAt, // Assuming createdAt is the relevant date
          };
        }),
      );

      res.json(galleriesWithDetails);
    } catch (error) {
      console.error("Get galleries error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Gallerien" });
    }
  });

  // Get latest activity for all galleries
  app.get(
    "/api/galleries/activities",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const userId = req.user.userId; // Get userId from JWT token
        // Get all galleries for the user (including sub-galleries)
        const userGalleries = await storage.getGalleriesByUserId(userId);
        const galleryIds = userGalleries.map((g) => g.id);

        if (galleryIds.length === 0) {
          return res.json({}); // Return empty object if no galleries found
        }

        // Get latest activity from each source for each gallery
        const activities: Record<string, string> = {};

        for (const galleryId of galleryIds) {
          const photos = await storage.getPhotosByGalleryId(galleryId);
          const comments = await storage.getCommentsByPhotoId(galleryId);

          // Get all creation dates
          const dates = [
            ...photos.map((p) => p.createdAt),
            ...comments.map((c) => c.createdAt),
          ].filter((date) => date !== null);

          if (dates.length > 0) {
            const mostRecent = dates.reduce((latest, current) =>
              new Date(current!) > new Date(latest!) ? current : latest,
            );
            activities[galleryId] = mostRecent!.toISOString();
          }
        }

        res.json(activities);
      } catch (error) {
        console.error("Error fetching gallery activities:", error);
        res.status(500).json({ error: "Failed to fetch gallery activities" });
      }
    },
  );

  app.get("/api/galleries/:id", authenticateJWT, async (req: any, res) => {
    try {
      const gallery = await storage.getGallery(req.params.id);
      if (!gallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }

      // Check if user has access to this gallery
      const userId = req.user.userId;

      // For sub-galleries, check access based on parent gallery
      let checkGallery = gallery;
      if (gallery.parentId) {
        const parentGallery = await storage.getGallery(gallery.parentId);
        if (parentGallery) {
          checkGallery = parentGallery;
        }
      }

      // Check if user is the owner of the (parent) gallery
      const isOwner = checkGallery.userId === userId;
      
      if (!isOwner) {
        // Check if (parent) gallery is assigned to user
        const assignments = await storage.getGalleryAssignments(checkGallery.id);
        const isAssigned = assignments.some((a: any) => a.userId === userId);
        
        if (!isAssigned) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }
      }

      res.json(gallery);
    } catch (error) {
      console.error("Get gallery error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Galerie" });
    }
  });

  app.post(
    "/api/galleries",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const galleryData = insertGallerySchema.parse(req.body);

        // Hash password if provided
        if (galleryData.password) {
          const saltRounds = 10;
          galleryData.password = await bcrypt.hash(
            galleryData.password,
            saltRounds,
          );
        }

        const gallery = await storage.createGallery(galleryData);
        res.status(201).json(gallery);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Ungültige Galerie-Daten", details: error.errors });
        }
        console.error("Create gallery error:", error);
        res.status(500).json({ error: "Fehler beim Erstellen der Galerie" });
      }
    },
  );

  app.put(
    "/api/galleries/:id",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const updates = insertGallerySchema.partial().parse(req.body);

        // Hash password if provided in update
        if (updates.password) {
          const saltRounds = 10;
          updates.password = await bcrypt.hash(updates.password, saltRounds);
        }

        const gallery = await storage.updateGallery(req.params.id, updates);
        if (!gallery) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }
        res.json(gallery);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Ungültige Galerie-Daten", details: error.errors });
        }
        console.error("Update gallery error:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Aktualisieren der Galerie" });
      }
    },
  );

  // Rename gallery endpoint
  app.patch(
    "/api/galleries/:id/rename",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const { name } = req.body;
        if (!name || typeof name !== "string" || name.trim() === "") {
          return res
            .status(400)
            .json({ error: "Gültiger Name ist erforderlich" });
        }

        const gallery = await storage.updateGallery(req.params.id, {
          name: name.trim(),
        });
        if (!gallery) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }
        res.json(gallery);
      } catch (error) {
        console.error("Rename gallery error:", error);
        res.status(500).json({ error: "Fehler beim Umbenennen der Galerie" });
      }
    },
  );

  // Get gallery password endpoint
  app.get(
    "/api/galleries/:id/password",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const gallery = await storage.getGallery(req.params.id);
        if (!gallery) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }
        
        // Return the password (it's hashed, but we can't decrypt it)
        // For display purposes, we'll return a placeholder if password exists
        res.json({ 
          password: gallery.password ? "••••••••" : "",
          hasPassword: !!gallery.password
        });
      } catch (error) {
        console.error("Get password error:", error);
        res.status(500).json({ error: "Fehler beim Laden des Passworts" });
      }
    },
  );

  // Change password endpoint
  app.patch(
    "/api/galleries/:id/password",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const { password } = req.body;

        let hashedPassword = null;
        if (password && password.trim()) {
          const saltRounds = 10;
          hashedPassword = await bcrypt.hash(password.trim(), saltRounds);
        }

        const gallery = await storage.updateGallery(req.params.id, {
          password: hashedPassword,
        });
        if (!gallery) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }
        res.json(gallery);
      } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Fehler beim Ändern des Passworts" });
      }
    },
  );

  // Update download settings endpoint
  app.patch(
    "/api/galleries/:id/download-settings",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const { allowDownload } = req.body;

        if (typeof allowDownload !== "boolean") {
          return res.status(400).json({ error: "allowDownload muss ein Boolean sein" });
        }

        const gallery = await storage.updateGallery(req.params.id, {
          allowDownload,
        });
        if (!gallery) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }
        res.json(gallery);
      } catch (error) {
        console.error("Update download settings error:", error);
        res.status(500).json({ error: "Fehler beim Aktualisieren der Download-Einstellungen" });
      }
    },
  );

  app.delete(
    "/api/galleries/:id",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        // Get all photos before deleting from database
        const photos = await storage.getPhotosByGalleryId(req.params.id);

        const success = await storage.deleteGallery(req.params.id);
        if (!success) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }

        // Delete physical files including thumbnails
        for (const photo of photos) {
          // Delete original file
          const filePath =
            photo.filePath ||
            `uploads/galleries/${photo.galleryId}/${photo.filename}`;
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          // Delete thumbnails using ThumbnailGenerator
          await ThumbnailGenerator.deleteThumbnails(
            photo.filename,
            photo.galleryId,
          );
        }

        // Try to remove the gallery directory if it's empty
        const galleryDir = `uploads/galleries/${req.params.id}`;
        if (fs.existsSync(galleryDir)) {
          try {
            fs.rmdirSync(galleryDir);
          } catch (error) {
            console.log(`Could not remove directory ${galleryDir}:`, error);
          }
        }

        // Try to remove the thumbnails directory for this gallery
        const thumbnailsDir = `uploads/galleries/thumbnails/${req.params.id}`;
        if (fs.existsSync(thumbnailsDir)) {
          try {
            fs.rmSync(thumbnailsDir, { recursive: true, force: true });
          } catch (error) {
            console.log(`Could not remove thumbnails directory ${thumbnailsDir}:`, error);
          }
        }

        res.status(204).send();
      } catch (error) {
        console.error("Delete gallery error:", error);
        res.status(500).json({ error: "Fehler beim Löschen der Galerie" });
      }
    },
  );

  // Sub-galleries route
  app.get("/api/galleries/:parentId/sub-galleries", authenticateJWT, async (req: any, res) => {
    try {
      const { parentId } = req.params;
      
      // Check if user has access to parent gallery
      const parentGallery = await storage.getGallery(parentId);
      if (!parentGallery) {
        return res.status(404).json({ error: "Parent gallery not found" });
      }

      const userId = req.user.userId;

      // Check if user is the owner of parent gallery
      const isOwner = parentGallery.userId === userId;
      
      if (!isOwner) {
        // Check if parent gallery is assigned to user
        const assignments = await storage.getGalleryAssignments(parentId);
        const isAssigned = assignments.some((a: any) => a.userId === userId);
        
        if (!isAssigned) {
          return res.status(404).json({ error: "Gallery not found" });
        }
      }

      const subGalleries = await storage.getSubGalleriesByParentId(parentId);

      // Add photo count for each sub-gallery
      const subGalleriesWithPhotoCounts = await Promise.all(
        subGalleries.map(async (gallery) => {
          const photos = await storage.getPhotosByGalleryId(gallery.id);
          return {
            ...gallery,
            photoCount: photos.length,
            lastModified: gallery.createdAt,
          };
        }),
      );

      res.json(subGalleriesWithPhotoCounts);
    } catch (error) {
      console.error("Get sub-galleries error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Sub-Galerien" });
    }
  });

  // Gallery preview image route
  app.get("/api/galleries/:galleryId/preview", authenticateJWT, async (req: any, res) => {
    try {
      const { galleryId } = req.params;
      
      // Check if user has access to this gallery
      const gallery = await storage.getGallery(galleryId);
      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found" });
      }

      const userId = req.user.userId;

      // For sub-galleries, check access based on parent gallery
      let checkGallery = gallery;
      if (gallery.parentId) {
        const parentGallery = await storage.getGallery(gallery.parentId);
        if (parentGallery) {
          checkGallery = parentGallery;
        }
      }

      // Check if user is the owner of the (parent) gallery
      const isOwner = checkGallery.userId === userId;
      
      if (!isOwner) {
        // Check if (parent) gallery is assigned to user
        const assignments = await storage.getGalleryAssignments(checkGallery.id);
        const isAssigned = assignments.some((a: any) => a.userId === userId);
        
        if (!isAssigned) {
          return res.status(404).json({ error: "Gallery not found" });
        }
      }

      const photos = await storage.getPhotosByGalleryId(galleryId);

      if (photos.length === 0) {
        return res
          .status(404)
          .json({ error: "Keine Fotos in der Galerie gefunden" });
      }

      // Return the first photo as preview using thumbnail
      const previewPhoto = photos[0];
      res.json({
        id: previewPhoto.id,
        src: `/${previewPhoto.thumbnailPath || previewPhoto.filePath}`,
        alt: previewPhoto.alt,
      });
    } catch (error) {
      console.error("Get gallery preview error:", error);
      res.status(500).json({ error: "Fehler beim Laden des Vorschaubilds" });
    }
  });

  // Photo routes
  app.get(
    "/api/galleries/:galleryId/photos",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { galleryId } = req.params;
        const gallery = await storage.getGallery(galleryId);

        if (!gallery) {
          return res.status(404).json({ error: "Gallery not found" });
        }

        // Check if user has access to this gallery
        const userId = req.user.userId;

        // For sub-galleries, check access based on parent gallery
        let checkGallery = gallery;
        if (gallery.parentId) {
          const parentGallery = await storage.getGallery(gallery.parentId);
          if (parentGallery) {
            checkGallery = parentGallery;
          }
        }

        // Check if user is the owner of the (parent) gallery
        const isOwner = checkGallery.userId === userId;
        
        if (!isOwner) {
          // Check if (parent) gallery is assigned to user
          const assignments = await storage.getGalleryAssignments(checkGallery.id);
          const isAssigned = assignments.some((a: any) => a.userId === userId);
          
          if (!isAssigned) {
            return res.status(404).json({ error: "Gallery not found" });
          }
        }

        console.log(`Fetching photos for gallery ${galleryId}...`);
        const startTime = Date.now();

        // Add timeout for large galleries
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Request timeout - gallery too large")),
            30000,
          ); // 30s timeout
        });

        // For authenticated users, get photos with data (likes, comments, etc.)
        const photosPromise = storage.getPhotosWithData(galleryId);

        const photos = (await Promise.race([
          photosPromise,
          timeoutPromise,
        ])) as any[];

        const endTime = Date.now();
        console.log(
          `Fetched ${photos.length} photos in ${endTime - startTime}ms`,
        );

        // Map photos to use thumbnail paths if available, otherwise original paths
        const photosWithCorrectPaths = photos.map((photo) => ({
          ...photo,
          filePath: photo.filePath, // Prioritize thumbnail, then medium, then original
        }));

        res.json(photosWithCorrectPaths);
      } catch (error) {
        console.error("Error fetching gallery photos:", error);
        if (error.message === "Request timeout - gallery too large") {
          res
            .status(408)
            .json({ error: "Gallery ist zu groß - Anfrage abgebrochen" });
        } else {
          res.status(500).json({ error: "Failed to fetch photos" });
        }
      }
    },
  );

  // Photo upload endpoint
  app.post(
    "/api/galleries/:galleryId/photos/upload",
    authenticateJWT,
    requireAdminOrCreator,
    (req: any, res) => {
      upload.single("photo")(req, res, async (err) => {
        if (err) {
          console.error("Upload error:", err);
          return res.status(400).json({ error: err.message });
        }

        try {
          if (!req.file) {
            return res.status(400).json({ error: "Keine Datei hochgeladen" });
          }

          const { alt } = req.body;
          if (!alt) {
            return res.status(400).json({ error: "Alt-Text ist erforderlich" });
          }

          // Generate thumbnails
          const thumbnailPaths = await ThumbnailGenerator.generateThumbnails(
            req.file.path,
            req.file.filename,
            req.params.galleryId,
          );

          const photoData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            alt: alt,
            galleryId: req.params.galleryId,
            filePath: thumbnailPaths.original,
            thumbnailPath: thumbnailPaths.thumbnail,
            mediumPath: thumbnailPaths.medium,
          };

          const photo = await storage.createPhoto(photoData);
          res.status(201).json(photo);
        } catch (error) {
          console.error("Upload photo error:", error);
          res.status(500).json({ error: "Fehler beim Hochladen des Fotos" });
        }
      });
    },
  );

  // Multiple photo upload endpoint
  app.post(
    "/api/galleries/:galleryId/photos/upload-multiple",
    authenticateJWT,
    requireAdminOrCreator,
    (req: any, res) => {
      upload.array("photos")(req, res, async (err) => {
        if (err) {
          console.error("Upload error:", err);
          return res.status(400).json({ error: err.message });
        }

        try {
          // User is already authenticated via JWT middleware

          if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "Keine Dateien hochgeladen" });
          }

          const files = req.files as Express.Multer.File[];
          const { alts } = req.body;
          const altTexts = JSON.parse(alts || "[]");

          const uploadedPhotos = [];

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const alt = altTexts[i] || file.originalname;

            // Generate thumbnails for each file
            const thumbnailPaths = await ThumbnailGenerator.generateThumbnails(
              file.path,
              file.filename,
              req.params.galleryId,
            );

            const photoData = {
              filename: file.filename,
              originalName: file.originalname,
              alt: alt,
              galleryId: req.params.galleryId,
              filePath: thumbnailPaths.original,
              thumbnailPath: thumbnailPaths.thumbnail,
              mediumPath: thumbnailPaths.medium,
            };

            const photo = await storage.createPhoto(photoData);
            uploadedPhotos.push(photo);
          }

          res.status(201).json({ photos: uploadedPhotos });
        } catch (error) {
          console.error("Upload multiple photos error:", error);
          res.status(500).json({ error: "Fehler beim Hochladen der Fotos" });
        }
      });
    },
  );

  app.post("/api/galleries/:galleryId/photos", async (req, res) => {
    try {
      const photoData = insertPhotoSchema.parse({
        ...req.body,
        galleryId: req.params.galleryId,
      });
      const photo = await storage.createPhoto(photoData);
      res.status(201).json(photo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Ungültige Foto-Daten", details: error.errors });
      }
      console.error("Create photo error:", error);
      res.status(500).json({ error: "Fehler beim Hinzufügen des Fotos" });
    }
  });

  // Batch delete photos - MUST be before parametrized route
  app.delete(
    "/api/photos/batch",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        const { photoIds } = req.body;

        if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
          return res.status(400).json({ error: "Foto-IDs sind erforderlich" });
        }

        console.log("Batch delete request for photos:", photoIds);

        const deletedPhotos = [];
        const errors = [];

        for (const photoId of photoIds) {
          try {
            // Get photo info before deleting
            const photo = await storage.getPhoto(photoId);
            if (photo) {
              console.log(`Deleting photo ${photoId}:`, photo.filename);

              // Delete from database
              const success = await storage.deletePhoto(photoId);
              if (success) {
                // Delete physical files including thumbnails
                await ThumbnailGenerator.deleteThumbnails(
                  photo.filename,
                  photo.galleryId,
                );
                console.log(`Deleted files for photo: ${photo.filename}`);
                deletedPhotos.push(photoId);
              } else {
                console.error(
                  `Failed to delete photo ${photoId} from database`,
                );
                errors.push({
                  photoId,
                  error: "Fehler beim Löschen aus der Datenbank",
                });
              }
            } else {
              console.log(
                `Photo ${photoId} not found, treating as already deleted`,
              );
              deletedPhotos.push(photoId);
            }
          } catch (error) {
            console.error(`Error deleting photo ${photoId}:`, error);
            errors.push({ photoId, error: (error as Error).message });
          }
        }

        console.log(
          `Batch delete result: ${deletedPhotos.length} deleted, ${errors.length} errors`,
        );

        res.json({
          deleted: deletedPhotos,
          errors: errors,
          success: deletedPhotos.length,
          failed: errors.length,
        });
      } catch (error) {
        console.error("Batch delete photos error:", error);
        res.status(500).json({ error: "Fehler beim Löschen der Fotos" });
      }
    },
  );

  app.delete(
    "/api/photos/:id",
    authenticateJWT,
    requireAdminOrCreator,
    async (req: any, res) => {
      try {
        // Get photo info before deleting from database
        const photo = await storage.getPhoto(req.params.id);
        if (!photo) {
          return res.status(404).json({ error: "Foto nicht gefunden" });
        }

        // Delete from database
        const success = await storage.deletePhoto(req.params.id);
        if (!success) {
          return res.status(404).json({ error: "Foto nicht gefunden" });
        }

        // Delete physical files including thumbnails
        await ThumbnailGenerator.deleteThumbnails(
          photo.filename,
          photo.galleryId,
        );

        res.status(204).send();
      } catch (error) {
        console.error("Delete photo error:", error);
        res.status(500).json({ error: "Fehler beim Löschen des Fotos" });
      }
    },
  );

  // Public download endpoint (no auth required)
  app.post("/api/public/photos/download", async (req, res) => {
    try {
      const { photoIds } = req.body;

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: "photoIds array is required" });
      }

      console.log(`Public download request for ${photoIds.length} photos`);

      // Set headers for ZIP download
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="photos_${new Date().toISOString().split("T")[0]}.zip"`,
      );

      // Create ZIP archive
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      // Pipe archive to response
      archive.pipe(res);

      let addedCount = 0;

      for (const photoId of photoIds) {
        try {
          const photo = await storage.getPhoto(photoId);

          if (photo) {
            const filePath =
              photo.filePath ||
              `uploads/galleries/${photo.galleryId}/${photo.filename}`;

            try {
              // Check if file exists before adding to archive
              await fs.promises.access(filePath, fs.constants.R_OK);
              
              // Get file extension from filename
              const extension = path.extname(photo.filename);
              // Add file to archive with alt text + original extension
              const archiveFilename = photo.alt + extension;
              archive.file(filePath, { name: archiveFilename });
              addedCount++;
            } catch (fileError) {
              console.warn(`Could not access file ${filePath}:`, fileError);
            }
          } else {
            console.warn(`Photo with ID ${photoId} not found.`);
          }
        } catch (photoError) {
          console.error(`Error processing photo ${photoId}:`, photoError);
        }
      }

      if (addedCount === 0) {
        archive.finalize();
        return res
          .status(404)
          .json({ error: "No photos found or accessible for download" });
      }

      console.log(`Adding ${addedCount} photos to ZIP archive`);

      // Finalize the archive
      archive.finalize();
    } catch (error) {
      console.error("Public download error:", error);
      res.status(500).json({ error: "Failed to create download archive" });
    }
  });

  // Download multiple photos as ZIP (authenticated)
  app.post("/api/photos/download", authenticateJWT, async (req: any, res) => {
    try {
      const { photoIds } = req.body;

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: "photoIds array is required" });
      }

      console.log(`Download request for ${photoIds.length} photos`);

      // Set headers for ZIP download
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="photos_${new Date().toISOString().split("T")[0]}.zip"`,
      );

      // Create ZIP archive
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      // Pipe archive to response
      archive.pipe(res);

      let addedCount = 0;

      for (const photoId of photoIds) {
        try {
          const photo = await storage.getPhoto(photoId);

          if (photo) {
            const filePath =
              photo.filePath ||
              `uploads/galleries/${photo.galleryId}/${photo.filename}`;

            try {
              // Check if file exists before adding to archive
              await fs.promises.access(filePath, fs.constants.R_OK);
              
              // Get file extension from filename
              const extension = path.extname(photo.filename);
              // Add file to archive with alt text + original extension
              const archiveFilename = photo.alt + extension;
              archive.file(filePath, { name: archiveFilename });
              addedCount++;
            } catch (fileError) {
              console.warn(`Could not access file ${filePath}:`, fileError);
            }
          } else {
            console.warn(`Photo with ID ${photoId} not found.`);
          }
        } catch (photoError) {
          console.error(`Error processing photo ${photoId}:`, photoError);
        }
      }

      if (addedCount === 0) {
        archive.finalize();
        return res
          .status(404)
          .json({ error: "No photos found or accessible for download" });
      }

      console.log(`Adding ${addedCount} photos to ZIP archive`);

      // Finalize the archive
      archive.finalize();
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to create download archive" });
    }
  });

  // Rating routes
  app.get("/api/photos/:photoId/rating", async (req, res) => {
    try {
      const photo = await storage.getPhoto(req.params.photoId);
      if (!photo) {
        return res.status(404).json({ error: "Foto nicht gefunden" });
      }
      res.json({ rating: photo.rating || 0 });
    } catch (error) {
      console.error("Get rating error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Bewertung" });
    }
  });

  // Batch rating endpoint
  app.post(
    "/api/photos/batch/rating",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { photoIds, rating, userName } = req.body;
        console.log("Batch rating request - photoIds:", photoIds);
        console.log("Batch rating request - rating:", rating);

        if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
          return res.status(400).json({ error: "Photo-IDs sind erforderlich" });
        }

        if (typeof rating !== "number" || rating < 0 || rating > 5) {
          return res
            .status(400)
            .json({ error: "Rating muss zwischen 0 und 5 sein" });
        }

        await storage.setPhotosRating(photoIds, rating);

        // Get updated photos data
        const updatedPhotos = [];
        for (const photoId of photoIds) {
          const photo = await storage.getPhoto(photoId);
          if (photo) {
            updatedPhotos.push({
              id: photo.id,
              rating: photo.rating || 0,
            });
          }
        }

        // Create batch notification if multiple photos are rated
        if (photoIds.length > 1) {
          // Get the first photo to determine gallery and owner
          const firstPhoto = await storage.getPhoto(photoIds[0]);
          const gallery = firstPhoto
            ? await storage.getGallery(firstPhoto.galleryId)
            : null;

          if (firstPhoto && gallery?.userId) {
            // Get photo names for the first photo and count others
            const firstPhotoName = firstPhoto.alt || firstPhoto.filename;
            const otherCount = photoIds.length - 1;
            const starText = rating === 1 ? "Stern" : "Sterne";
            const actorName = userName || "Anonymer Besucher";
            const actorText = userName || "Jemand";

            const message = `${actorText} hat Bild "${firstPhotoName}" und ${otherCount} weitere mit ${rating} ${starText} bewertet`;

            // Create notification async without blocking response
            storage
              .createNotification({
                userId: gallery.userId,
                galleryId: gallery.id,
                photoId: firstPhoto.id,
                type: "rating",
                message,
                actorName,
                isRead: false,
              })
              .catch((error) =>
                console.error("Error creating batch notification:", error),
              );
          }
        }

        res.json({
          success: true,
          message: `${photoIds.length} Fotos bewertet`,
          photos: updatedPhotos,
        });
      } catch (error) {
        console.error("Batch rating error:", error);
        res.status(500).json({ error: "Fehler beim Setzen der Bewertungen" });
      }
    },
  );

  // Set photo rating
  app.post(
    "/api/photos/:photoId/rating",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { photoId } = req.params;
        const { rating, userName } = req.body;

        if (typeof rating !== "number" || rating < 0 || rating > 5) {
          return res
            .status(400)
            .json({ error: "Rating muss zwischen 0 und 5 sein" });
        }

        const success = await storage.setPhotoRating(photoId, rating);
        if (!success) {
          return res.status(404).json({ error: "Foto nicht gefunden" });
        }

        // Get updated photo data
        const updatedPhoto = await storage.getPhoto(photoId);
        if (!updatedPhoto) {
          return res.status(404).json({ error: "Foto nicht gefunden" });
        }

        // Create notification asynchronously (don't wait for it)
        const gallery = await storage.getGallery(updatedPhoto.galleryId);

        if (gallery?.userId) {
          const actorName = userName || "Anonymer Besucher";
          const actorText = userName || "Jemand";
          const message = `${actorText} hat Bild "${updatedPhoto.alt}" in Galerie "${gallery.name}" mit ${rating} Stern${rating !== 1 ? "en" : ""} bewertet`;

          // Create notification async without blocking response
          storage
            .createNotification({
              userId: gallery.userId,
              galleryId: gallery.id,
              photoId,
              type: "rating",
              message,
              actorName,
              isRead: false,
            })
            .catch((error) =>
              console.error("Error creating notification:", error),
            );
        }

        res.json({
          success: true,
          photo: {
            id: updatedPhoto.id,
            rating: updatedPhoto.rating || 0,
          },
        });
      } catch (error) {
        console.error("Rating error:", error);
        res.status(500).json({ error: "Fehler beim Setzen der Bewertung" });
      }
    },
  );

  // Like routes
  app.get("/api/photos/:photoId/like", async (req, res) => {
    try {
      const likes = await storage.getAllPhotoLikes(req.params.photoId);
      const likeCount = likes.filter((like) => like.isLiked).length;
      const dislikeCount = likes.filter((like) => !like.isLiked).length;
      const currentStatus = likeCount > dislikeCount;

      res.json({
        likeCount,
        dislikeCount,
        totalLikes: likes.length,
        isLiked: currentStatus,
      });
    } catch (error) {
      console.error("Get like error:", error);
      res.status(500).json({ error: "Fehler beim Laden des Likes" });
    }
  });

  app.post(
    "/api/photos/:photoId/like",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { isLiked, userName } = req.body;
        const { photoId } = req.params;

        if (typeof isLiked !== "boolean") {
          return res
            .status(400)
            .json({ error: "isLiked muss ein Boolean sein" });
        }

        const like = await storage.togglePhotoLike(photoId, isLiked);

        // Get updated like status efficiently
        const allLikes = await storage.getAllPhotoLikes(photoId);
        const likeCount = allLikes.filter((like) => like.isLiked).length;
        const dislikeCount = allLikes.filter((like) => !like.isLiked).length;
        const currentStatus = likeCount > dislikeCount;

        // Create notification asynchronously (don't wait for it)
        const photo = await storage.getPhoto(photoId);
        const gallery = photo
          ? await storage.getGallery(photo.galleryId)
          : null;

        if (photo && gallery?.userId) {
          const action = isLiked ? "geliked" : "entliked";
          const actorName = userName || "Anonymer Besucher";
          const actorText = userName || "Jemand";
          const message = `${actorText} hat Bild "${photo.alt}" in Galerie "${gallery.name}" ${action}`;

          // Create notification async without blocking response
          storage
            .createNotification({
              userId: gallery.userId,
              galleryId: gallery.id,
              photoId,
              type: "like",
              message,
              actorName,
              isRead: false,
            })
            .catch((error) =>
              console.error("Error creating notification:", error),
            );
        }

        res.json({
          success: true,
          photo: {
            id: photoId,
            isLiked: currentStatus,
            likeCount: likeCount,
          },
        });
      } catch (error) {
        console.error("Set like error:", error);
        res.status(500).json({ error: "Fehler beim Speichern des Likes" });
      }
    },
  );

  // Comment routes
  app.get("/api/photos/:photoId/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByPhotoId(req.params.photoId);
      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Kommentare" });
    }
  });

  app.post(
    "/api/photos/:photoId/comments",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { commenterName, text } = req.body;
        const { photoId } = req.params;

        if (!commenterName || !text) {
          return res
            .status(400)
            .json({ error: "Name und Text sind erforderlich" });
        }

        const commentId = await storage.addComment(
          photoId,
          commenterName,
          text,
        );

        // Create comment notification for gallery owner
        try {
          const photo = await storage.getPhoto(photoId);
          const gallery = photo
            ? await storage.getGallery(photo.galleryId)
            : null;

          if (photo && gallery?.userId) {
            const message = `${commenterName} hat einen Kommentar zu Bild "${photo.alt}" in Galerie "${gallery.name}" hinterlassen`;

            console.log("=== COMMENT NOTIFICATION DEBUG ===");
            console.log("Photo:", photo);
            console.log("Gallery:", gallery);
            console.log("Gallery userId:", gallery.userId);
            console.log("Message:", message);

            const notification = await storage.createNotification({
              userId: gallery.userId,
              galleryId: gallery.id,
              photoId,
              type: "comment",
              message,
              actorName: commenterName,
              isRead: false,
            });
            console.log(
              "Comment notification created successfully:",
              notification,
            );
            console.log("=== END COMMENT NOTIFICATION DEBUG ===");
          }
        } catch (notificationError) {
          console.error(
            "Error creating comment notification:",
            notificationError,
          );
        }

        res.status(201).json({ success: true, commentId });
      } catch (error) {
        console.error("Create comment error:", error);
        res.status(500).json({ error: "Fehler beim Erstellen des Kommentars" });
      }
    },
  );


  // Notification routes
  app.get(
    "/api/notifications/:userId",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const notifications = await storage.getNotificationsByUserId(userId);
        res.json(notifications);
      } catch (error) {
        console.error("Get notifications error:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Laden der Benachrichtigungen" });
      }
    },
  );

  app.post("/api/notifications", authenticateJWT, async (req: any, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Ungültige Benachrichtigungs-Daten",
            details: error.errors,
          });
      }
      console.error("Create notification error:", error);
      res
        .status(500)
        .json({ error: "Fehler beim Erstellen der Benachrichtigung" });
    }
  });

  app.patch(
    "/api/notifications/:id/read",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const success = await storage.markNotificationAsRead(req.params.id);
        if (!success) {
          return res
            .status(404)
            .json({ error: "Benachrichtigung nicht gefunden" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Mark notification as read error:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Markieren der Benachrichtigung" });
      }
    },
  );

  app.patch(
    "/api/notifications/:userId/read-all",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { userId } = req.params;

        // Sicherheitscheck: User darf nur eigene Notifications als gelesen markieren
        if (req.user.userId !== userId && req.user.role !== "Admin") {
          return res.status(403).json({ error: "Keine Berechtigung" });
        }
        const success = await storage.markAllNotificationsAsRead(userId);
        res.json({ success });
      } catch (error) {
        console.error("Mark all notifications as read error:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Markieren aller Benachrichtigungen" });
      }
    },
  );

  // Gallery assignment routes
  app.get(
    "/api/galleries/:galleryId/assignments",
    authenticateJWT,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { galleryId } = req.params;
        const assignments = await storage.getGalleryAssignments(galleryId);
        res.json(assignments);
      } catch (error) {
        console.error("Get gallery assignments error:", error);
        res.status(500).json({ error: "Fehler beim Laden der Zuweisungen" });
      }
    },
  );

  // Get all gallery assignments (for all galleries and users)
  app.get(
    "/api/all-assignments",
    authenticateJWT,
    requireAdmin,
    async (req: any, res) => {
      try {
        const assignments = await storage.getAllGalleryAssignments();
        res.json(assignments);
      } catch (error) {
        console.error("Get all assignments error:", error);
        res.status(500).json({ error: "Fehler beim Laden aller Zuweisungen" });
      }
    },
  );

  app.post(
    "/api/galleries/:galleryId/assignments",
    authenticateJWT,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { galleryId } = req.params;
        const { userIds } = req.body;

        if (!Array.isArray(userIds)) {
          return res.status(400).json({ error: "userIds muss ein Array sein" });
        }

        const assignments = await storage.assignGalleryToUsers(
          galleryId,
          userIds,
        );
        res.status(201).json(assignments);
      } catch (error) {
        console.error("Assign gallery error:", error);
        res.status(500).json({ error: "Fehler beim Zuweisen der Galerie" });
      }
    },
  );

  app.delete(
    "/api/galleries/:galleryId/assignments/:userId",
    authenticateJWT,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { galleryId, userId } = req.params;
        const success = await storage.removeGalleryAssignment(
          galleryId,
          userId,
        );
        if (!success) {
          return res.status(404).json({ error: "Zuweisung nicht gefunden" });
        }
        res.status(204).send();
      } catch (error) {
        console.error("Remove gallery assignment error:", error);
        res.status(500).json({ error: "Fehler beim Entfernen der Zuweisung" });
      }
    },
  );

  // Get galleries assigned to a user
  app.get(
    "/api/users/:userId/assigned-galleries",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const assignedGalleries =
          await storage.getUserAssignedGalleries(userId);
        res.json(assignedGalleries);
      } catch (error) {
        console.error("Get assigned galleries error:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Laden der zugewiesenen Gallerien" });
      }
    },
  );

  const httpServer = createServer(app);

  return httpServer;
}