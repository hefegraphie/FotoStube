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

export async function registerAuthRoutes(app: Express): Promise<void> {
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
        if (!user && name.includes("@")) {
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
    })
  app.post("/api/auth/logout", (req, res) => {
      res.clearCookie("authToken");
      res.json({ success: true });
    })
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
    })
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
    })
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
            message:
              "Falls diese E-Mail registriert ist, wurde ein Reset-Link gesendet",
          });
        }

        // Generiere einen sicheren, zufälligen Token
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Token ist 1 Stunde gültig
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        // Speichere den Token in der Datenbank
        await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

        // Sende die E-Mail
        const emailSent = await sendPasswordResetEmail(
          user.email,
          resetToken,
          user.name,
        );

        if (!emailSent) {
          console.error("Failed to send password reset email to:", user.email);
          // Trotzdem erfolgreiche Antwort (aus Sicherheitsgründen)
        }

        res.json({
          message:
            "Falls diese E-Mail registriert ist, wurde ein Reset-Link gesendet",
        });
      } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Fehler beim Senden des Reset-Links" });
      }
    })
  app.post("/api/auth/reset-password", async (req, res) => {
      try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
          return res
            .status(400)
            .json({ error: "Token und neues Passwort sind erforderlich" });
        }

        if (newPassword.length < 6) {
          return res
            .status(400)
            .json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
        }

        // Suche den Token in der Datenbank
        const resetToken = await storage.getPasswordResetToken(token);

        if (!resetToken) {
          return res
            .status(400)
            .json({ error: "Ungültiger oder abgelaufener Reset-Link" });
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
    })
  // Public endpoint: check if registration is enabled
  app.get("/api/auth/registration-status", async (_req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json({ enabled: settings?.registrationEnabled ?? false });
    } catch (error) {
      console.error("Error checking registration status:", error);
      res.json({ enabled: false });
    }
  });

  // Simple in-memory rate limiter for registration
  const registerAttempts = new Map<string, { count: number; resetAt: number }>();
  const REGISTER_RATE_LIMIT = 5;
  const REGISTER_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

  function checkRegisterRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = registerAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
      registerAttempts.set(ip, { count: 1, resetAt: now + REGISTER_RATE_WINDOW });
      return { allowed: true };
    }
    if (entry.count >= REGISTER_RATE_LIMIT) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }
    entry.count++;
    return { allowed: true };
  }

  app.post("/api/auth/register", async (req, res) => {
      try {
        // Check if registration is enabled
        const settings = await storage.getSystemSettings();
        if (!settings?.registrationEnabled) {
          return res.status(403).json({ error: "Registrierung ist derzeit nicht möglich" });
        }

        // Rate limit check
        const clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const rateCheck = checkRegisterRateLimit(clientIp);
        if (!rateCheck.allowed) {
          res.set("Retry-After", String(rateCheck.retryAfter));
          return res.status(429).json({ error: `Zu viele Versuche. Bitte in ${rateCheck.retryAfter} Sekunden erneut versuchen.` });
        }

        const userData = insertUserSchema.parse(req.body);

        // Normalize email to lowercase
        userData.email = userData.email.toLowerCase();

        // Force role to "Creator" for self-registration
        userData.role = "Creator";

        // Check if user already exists by email (case-insensitive)
        const existingUserByEmail = await storage.getUserByEmail(userData.email);
        if (existingUserByEmail) {
          return res
            .status(409)
            .json({ error: "Benutzer mit dieser E-Mail existiert bereits" });
        }

        // Check if username already exists
        const existingUserByName = await storage.getUserByName(userData.name);
        if (existingUserByName) {
          return res.status(409).json({ error: "Benutzername bereits vergeben" });
        }

        // Validate password strength
        if (userData.password && userData.password.length < 6) {
          return res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
        }

        // Hash password before storing (same as createInitialAdmin)
        userData.password = await bcrypt.hash(userData.password, 10);

        const user = await storage.createUser(userData);
        const { password: _, ...userWithoutPassword } = user;

        // Auto-login: generate JWT and set cookie
        const { generateToken } = await import("./auth");
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });
        res.cookie("authToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({ user: userWithoutPassword, token });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Ungültige Benutzerdaten", details: error.errors });
        }
        console.error("Registration error:", error);
        res.status(500).json({ error: "Registrierungsfehler" });
      }
    })
}
