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

export async function registerPublicRoutes(app: Express): Promise<void> {
  app.get("/api/gallery/:galleryId/sub-galleries/public", async (req, res) => {
      try {
        const { galleryId } = req.params;

        // Get parent gallery info
        const parentGallery = await storage.getGallery(galleryId);
        if (!parentGallery) {
          return res.status(404).json({ error: "Galerie nicht gefunden" });
        }

        // For public access, we don't check password here - the gallery itself was already unlocked
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
    })
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
    })
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
    })
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
    })
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
    })
  app.post("/api/public/photos/:photoId/like", async (req, res) => {
      try {
        const { isLiked, userName } = req.body;
        const { photoId } = req.params;

        if (typeof isLiked !== "boolean") {
          return res.status(400).json({ error: "isLiked muss ein Boolean sein" });
        }

        const like = await storage.togglePhotoLike(photoId, isLiked);

        // Get updated like status
        const allLikes = await storage.getAllPhotoLikes(photoId);
        const likeCount = allLikes.filter((like) => like.isLiked).length;
        const dislikeCount = allLikes.filter((like) => !like.isLiked).length;
        const currentStatus = likeCount > dislikeCount;

        // Create notification asynchronously
        const photo = await storage.getPhoto(photoId);
        const gallery = photo ? await storage.getGallery(photo.galleryId) : null;

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
    })
  app.post("/api/public/photos/:photoId/comments", async (req, res) => {
      try {
        const { commenterName, text } = req.body;
        const { photoId } = req.params;

        if (!commenterName || !text) {
          return res
            .status(400)
            .json({ error: "Name und Text sind erforderlich" });
        }

        const commentId = await storage.addComment(photoId, commenterName, text);

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
    })
}
