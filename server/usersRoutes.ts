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

export async function registerUsersRoutes(app: Express): Promise<void> {
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
    )
  app.post("/api/users", authenticateJWT, requireAdmin, async (req, res) => {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res
          .status(400)
          .json({ error: "Name, E-Mail und Passwort sind erforderlich" });
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
    })
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
          return res
            .status(400)
            .json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });
        }
        updates.password = await bcrypt.hash(trimmedPassword, 10);
      }

      // Only update if there are actual changes
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(id, updates);
      }

      res.status(200).json({ message: "Benutzer erfolgreich aktualisiert" });
    })
  app.delete(
      "/api/users/:id",
      authenticateJWT,
      requireAdmin,
      async (req, res) => {
        const { id } = req.params;

        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ error: "Benutzer nicht gefunden" });
        }

        // Delete user and all associated gallery assignments
        await storage.deleteUser(id);
        res.json({ message: "Benutzer erfolgreich gelöscht" });
      },
    )
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
    )
}
