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

export async function registerDownloadsRoutes(app: Express): Promise<void> {
  const downloadCache = new Map<
      string,
      { photoIds: string[]; expiresAt: number }
    >();

    // Cleanup expired tokens every minute
    setInterval(() => {
      const now = Date.now();
      for (const [token, data] of downloadCache.entries()) {
        if (data.expiresAt < now) {
          downloadCache.delete(token);
        }
      }
    }, 60000);

  app.post(
      "/api/photos/prepare-download",
      authenticateJWT,
      async (req: any, res) => {
        try {
          const { photoIds } = req.body;

          if (!Array.isArray(photoIds) || photoIds.length === 0) {
            return res.status(400).json({ error: "photoIds array is required" });
          }

          // Generate unique token
          const token = crypto.randomBytes(32).toString("hex");

          // Store in cache with 5 minute expiration
          downloadCache.set(token, {
            photoIds,
            expiresAt: Date.now() + 5 * 60 * 1000,
          });

          res.json({ downloadUrl: `/api/download-zip/${token}` });
        } catch (error) {
          console.error("Prepare download error:", error);
          res.status(500).json({ error: "Failed to prepare download" });
        }
      },
    )
  app.post("/api/public/photos/prepare-download", async (req, res) => {
      try {
        const { photoIds } = req.body;

        if (!Array.isArray(photoIds) || photoIds.length === 0) {
          return res.status(400).json({ error: "photoIds array is required" });
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString("hex");

        // Store in cache with 5 minute expiration
        downloadCache.set(token, {
          photoIds,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });

        res.json({ downloadUrl: `/api/download-zip/${token}` });
      } catch (error) {
        console.error("Prepare download error:", error);
        res.status(500).json({ error: "Failed to prepare download" });
      }
    })
  app.get("/api/download-zip/:token", async (req, res) => {
      try {
        const { token } = req.params;

        // Get photoIds from cache
        const cacheEntry = downloadCache.get(token);

        if (!cacheEntry) {
          return res
            .status(404)
            .json({ error: "Download token expired or invalid" });
        }

        const { photoIds } = cacheEntry;

        // Delete token after use (one-time use)
        downloadCache.delete(token);

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
    })
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
    })
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
    })
}
