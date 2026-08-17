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

export async function registerNotificationsRoutes(app: Express): Promise<void> {
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
    )
  app.post("/api/notifications", authenticateJWT, async (req: any, res) => {
      try {
        const notificationData = insertNotificationSchema.parse(req.body);
        const notification = await storage.createNotification(notificationData);
        res.status(201).json(notification);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Ungültige Benachrichtigungs-Daten",
            details: error.errors,
          });
        }
        console.error("Create notification error:", error);
        res
          .status(500)
          .json({ error: "Fehler beim Erstellen der Benachrichtigung" });
      }
    })
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
    )
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
    )
}
