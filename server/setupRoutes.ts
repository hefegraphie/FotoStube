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
import { upload, ensureUploadDirs } from "./upload";

export async function registerSetupRoutes(app: Express): Promise<void> {
  app.get("/api/setup/status", async (req, res) => {
      try {
        const status = await checkInitialSetup();
        res.json(status);
      } catch (error) {
        console.error("Error checking setup status:", error);
        res.status(500).json({ error: "Fehler beim Prüfen des Setup-Status" });
      }
    })
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
          return res
            .status(400)
            .json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
        }

        const user = await createInitialAdmin({ name, email, password });
        const { password: _, ...userWithoutPassword } = user;

        res.status(201).json({ user: userWithoutPassword });
      } catch (error) {
        console.error("Error creating initial admin:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Erstellen des Admin-Benutzers" });
      }
    })
  app.post("/api/setup/configure-smtp", async (req, res) => {
      try {
        const status = await checkInitialSetup();

        // Allow SMTP configuration even if users exist but SMTP is not configured
        if (status.hasSmtpConfig && !req.user?.role) {
          return res.status(403).json({ error: "SMTP bereits konfiguriert" });
        }

        const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, appUrl } =
          req.body;

        // Allow skipping SMTP configuration
        if (!smtpHost && !smtpUser) {
          return res.json({
            skipped: true,
            message: "SMTP-Konfiguration übersprungen",
          });
        }

        if (
          !smtpHost ||
          !smtpPort ||
          !smtpUser ||
          !smtpPassword ||
          !smtpFrom ||
          !appUrl
        ) {
          return res
            .status(400)
            .json({ error: "Alle SMTP-Felder sind erforderlich" });
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
    })
  app.get(
      "/api/system-settings",
      authenticateJWT,
      requireAdmin,
      async (req: any, res) => {
        try {
          const settings = await storage.getSystemSettings();
          res.json(settings || {});
        } catch (error) {
          console.error("Error fetching system settings:", error);
          res.status(500).json({ error: "Failed to fetch system settings" });
        }
      },
    )
  app.post(
      "/api/system-settings",
      authenticateJWT,
      requireAdmin,
      async (req: any, res) => {
        try {
          const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, appUrl } =
            req.body;

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
      },
    )
  app.get("/api/branding", async (req, res) => {
      try {
        const settings = await db.query.brandingSettings.findFirst();
        res.json(settings || { companyName: "PhotoGallery" });
      } catch (error) {
        console.error("Error fetching branding settings:", error);
        res.status(500).json({ error: "Failed to fetch branding settings" });
      }
    })
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
    })
}
