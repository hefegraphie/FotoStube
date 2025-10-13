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
import archiver from 'archiver';
import { ThumbnailGenerator } from './thumbnailGenerator';
import { galleries, photos, users, comments, photoLikes, notifications } from "../shared/schema";
import { eq, desc } from 'drizzle-orm';

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
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email und Passwort sind erforderlich" });
      }

      const user = await storage.getUserByEmail(email);

      // Simple password check for demo (in production, use proper hashing)
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Ungültige Anmeldedaten" });
      }

      // Don't send password back to client
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Anmeldefehler" });
    }
  });

  // User registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ error: "Benutzer existiert bereits" });
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

      console.log('Public gallery data:', { galleryId, gallery });

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
      if (effectivePassword && effectivePassword !== password) {
        return res.status(401).json({ error: "Falsches Passwort" });
      }

      console.log('Public gallery data:', { galleryId, gallery });

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

  // Gallery routes
  app.get('/api/galleries', async (req, res) => {
    const userId = req.query.userId as string; // Get userId from query params for client-side fetching
    if (!userId) {
      return res.status(400).json({ error: "Benutzer-ID ist erforderlich" });
    }

    try {
      const galleriesData = await storage.getMainGalleriesByUserId(userId);

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
  app.get('/api/galleries/activities', async (req, res) => {
    const userId = req.query.userId as string; // Get userId from query params for client-side fetching
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      // Get all galleries for the user (including sub-galleries)
      const userGalleries = await storage.getGalleriesByUserId(userId);
      const galleryIds = userGalleries.map(g => g.id);

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
          ...photos.map(p => p.createdAt),
          ...comments.map(c => c.createdAt)
        ].filter(date => date !== null);

        if (dates.length > 0) {
          const mostRecent = dates.reduce((latest, current) =>
            new Date(current!) > new Date(latest!) ? current : latest
          );
          activities[galleryId] = mostRecent!.toISOString();
        }
      }

      res.json(activities);
    } catch (error) {
      console.error('Error fetching gallery activities:', error);
      res.status(500).json({ error: 'Failed to fetch gallery activities' });
    }
  });

  app.get("/api/galleries/:id", async (req, res) => {
    try {
      const gallery = await storage.getGallery(req.params.id);
      if (!gallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }
      res.json(gallery);
    } catch (error) {
      console.error("Get gallery error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Galerie" });
    }
  });

  app.post("/api/galleries", async (req, res) => {
    try {
      const galleryData = insertGallerySchema.parse(req.body);
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
  });

  app.put("/api/galleries/:id", async (req, res) => {
    try {
      const updates = insertGallerySchema.partial().parse(req.body);
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
      res.status(500).json({ error: "Fehler beim Aktualisieren der Galerie" });
    }
  });

  // Rename gallery endpoint
  app.patch("/api/galleries/:id/rename", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "Gültiger Name ist erforderlich" });
      }

      const gallery = await storage.updateGallery(req.params.id, { name: name.trim() });
      if (!gallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }
      res.json(gallery);
    } catch (error) {
      console.error("Rename gallery error:", error);
      res.status(500).json({ error: "Fehler beim Umbenennen der Galerie" });
    }
  });

  // Change password endpoint
  app.patch("/api/galleries/:id/password", async (req, res) => {
    try {
      const { password } = req.body;

      const gallery = await storage.updateGallery(req.params.id, { 
        password: password && password.trim() ? password.trim() : null 
      });
      if (!gallery) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }
      res.json(gallery);
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Fehler beim Ändern des Passworts" });
    }
  });

  app.delete("/api/galleries/:id", async (req, res) => {
    try {
      // Get all photos before deleting from database
      const photos = await storage.getPhotosByGalleryId(req.params.id);

      const success = await storage.deleteGallery(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Galerie nicht gefunden" });
      }

      // Delete physical files
      for (const photo of photos) {
        const filePath = photo.filePath || `uploads/galleries/${photo.galleryId}/${photo.filename}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
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

      res.status(204).send();
    } catch (error) {
      console.error("Delete gallery error:", error);
      res.status(500).json({ error: "Fehler beim Löschen der Galerie" });
    }
  });

  // Sub-galleries route
  app.get("/api/galleries/:parentId/sub-galleries", async (req, res) => {
    try {
      const { parentId } = req.params;
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
  app.get("/api/galleries/:galleryId/preview", async (req, res) => {
    try {
      const { galleryId } = req.params;
      const photos = await storage.getPhotosByGalleryId(galleryId);

      if (photos.length === 0) {
        return res.status(404).json({ error: "Keine Fotos in der Galerie gefunden" });
      }

      // Return the first photo as preview using thumbnail
      const previewPhoto = photos[0];
      res.json({
        id: previewPhoto.id,
        src: `/${previewPhoto.thumbnailPath || previewPhoto.filePath}`,
        alt: previewPhoto.alt
      });
    } catch (error) {
      console.error("Get gallery preview error:", error);
      res.status(500).json({ error: "Fehler beim Laden des Vorschaubilds" });
    }
  });

  // Photo routes
  app.get("/api/galleries/:galleryId/photos", async (req, res) => {
    try {
      const { galleryId } = req.params;
      const gallery = await storage.getGallery(galleryId);

      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found" });
      }

      console.log(`Fetching photos for gallery ${galleryId}...`);
      const startTime = Date.now();

      // Add timeout for large galleries
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout - gallery too large')), 30000); // 30s timeout
      });

      // For authenticated users, get photos with data (likes, comments, etc.)
      const photosPromise = storage.getPhotosWithData(galleryId);
      
      const photos = await Promise.race([photosPromise, timeoutPromise]) as any[];

      const endTime = Date.now();
      console.log(`Fetched ${photos.length} photos in ${endTime - startTime}ms`);

      // Map photos to use thumbnail paths if available, otherwise original paths
      const photosWithCorrectPaths = photos.map(photo => ({
        ...photo,
        filePath: photo.filePath // Prioritize thumbnail, then medium, then original
      }));

      res.json(photosWithCorrectPaths);
    } catch (error) {
      console.error('Error fetching gallery photos:', error);
      if (error.message === 'Request timeout - gallery too large') {
        res.status(408).json({ error: "Gallery ist zu groß - Anfrage abgebrochen" });
      } else {
        res.status(500).json({ error: "Failed to fetch photos" });
      }
    }
  });

  // Photo upload endpoint
  app.post("/api/galleries/:galleryId/photos/upload", (req, res) => {
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
          req.params.galleryId
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
  });

  // Multiple photo upload endpoint
  app.post("/api/galleries/:galleryId/photos/upload-multiple", (req, res) => {
    upload.array("photos")(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ error: err.message });
      }

      try {
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
            req.params.galleryId
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
  });

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
  app.delete("/api/photos/batch", async (req, res) => {
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
              await ThumbnailGenerator.deleteThumbnails(photo.filename, photo.galleryId);
              console.log(`Deleted files for photo: ${photo.filename}`);
              deletedPhotos.push(photoId);
            } else {
              console.error(`Failed to delete photo ${photoId} from database`);
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
  });

  app.delete("/api/photos/:id", async (req, res) => {
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
      await ThumbnailGenerator.deleteThumbnails(photo.filename, photo.galleryId);

      res.status(204).send();
    } catch (error) {
      console.error("Delete photo error:", error);
      res.status(500).json({ error: "Fehler beim Löschen des Fotos" });
    }
  });

  // Download multiple photos as ZIP
  app.post('/api/photos/download', async (req, res) => {
    try {
      const { photoIds } = req.body;

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: 'photoIds array is required' });
      }

      console.log(`Download request for ${photoIds.length} photos`);

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="photos_${new Date().toISOString().split('T')[0]}.zip"`);

      // Create ZIP archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Pipe archive to response
      archive.pipe(res);

      let addedCount = 0;

      for (const photoId of photoIds) {
        try {
          const photo = await storage.getPhoto(photoId);

          if (photo) {
            const filePath = photo.filePath || `uploads/galleries/${photo.galleryId}/${photo.filename}`;

            try {
              // Check if file exists before adding to archive
              await fs.promises.access(filePath, fs.constants.R_OK);
              // Add file to archive with original filename or alt text
              const archiveFilename = photo.alt || photo.filename;
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
        return res.status(404).json({ error: 'No photos found or accessible for download' });
      }

      console.log(`Adding ${addedCount} photos to ZIP archive`);

      // Finalize the archive
      archive.finalize();
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Failed to create download archive' });
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
  app.post('/api/photos/batch/rating', async (req, res) => {
    try {
      const { photoIds, rating, userName } = req.body;
      console.log("Batch rating request - photoIds:", photoIds);
      console.log("Batch rating request - rating:", rating);

      if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: 'Photo-IDs sind erforderlich' });
      }

      if (typeof rating !== 'number' || rating < 0 || rating > 5) {
        return res.status(400).json({ error: 'Rating muss zwischen 0 und 5 sein' });
      }

      await storage.setPhotosRating(photoIds, rating);

      // Get updated photos data
      const updatedPhotos = [];
      for (const photoId of photoIds) {
        const photo = await storage.getPhoto(photoId);
        if (photo) {
          updatedPhotos.push({
            id: photo.id,
            rating: photo.rating || 0
          });
        }
      }

      // Create batch notification if multiple photos are rated
      if (photoIds.length > 1) {
        // Get the first photo to determine gallery and owner
        const firstPhoto = await storage.getPhoto(photoIds[0]);
        const gallery = firstPhoto ? await storage.getGallery(firstPhoto.galleryId) : null;

        if (firstPhoto && gallery?.userId) {
          // Get photo names for the first photo and count others
          const firstPhotoName = firstPhoto.alt || firstPhoto.filename;
          const otherCount = photoIds.length - 1;
          const starText = rating === 1 ? 'Stern' : 'Sterne';
          const actorName = userName || 'Anonymer Besucher';
          const actorText = userName || 'Jemand';

          const message = `${actorText} hat Bild "${firstPhotoName}" und ${otherCount} weitere mit ${rating} ${starText} bewertet`;

          // Create notification async without blocking response
          storage.createNotification({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId: firstPhoto.id,
            type: 'rating',
            message,
            actorName,
            isRead: false
          }).catch(error => console.error('Error creating batch notification:', error));
        }
      }

      res.json({ 
        success: true, 
        message: `${photoIds.length} Fotos bewertet`,
        photos: updatedPhotos
      });
    } catch (error) {
      console.error("Batch rating error:", error);
      res.status(500).json({ error: "Fehler beim Setzen der Bewertungen" });
    }
  });

  // Set photo rating
  app.post('/api/photos/:photoId/rating', async (req, res) => {
    try {
      const { photoId } = req.params;
      const { rating, userName } = req.body;

      if (typeof rating !== 'number' || rating < 0 || rating > 5) {
        return res.status(400).json({ error: 'Rating muss zwischen 0 und 5 sein' });
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
        const actorName = userName || 'Anonymer Besucher';
        const actorText = userName || 'Jemand';
        const message = `${actorText} hat Bild "${updatedPhoto.alt}" in Galerie "${gallery.name}" mit ${rating} Stern${rating !== 1 ? 'en' : ''} bewertet`;

        // Create notification async without blocking response
        storage.createNotification({
          userId: gallery.userId,
          galleryId: gallery.id,
          photoId,
          type: 'rating',
          message,
          actorName,
          isRead: false
        }).catch(error => console.error('Error creating notification:', error));
      }

      res.json({ 
        success: true, 
        photo: {
          id: updatedPhoto.id,
          rating: updatedPhoto.rating || 0
        }
      });
    } catch (error) {
      console.error("Rating error:", error);
      res.status(500).json({ error: "Fehler beim Setzen der Bewertung" });
    }
  });

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

  app.post("/api/photos/:photoId/like", async (req, res) => {
    try {
      const { isLiked, userName } = req.body;
      const { photoId } = req.params;

      if (typeof isLiked !== "boolean") {
        return res.status(400).json({ error: "isLiked muss ein Boolean sein" });
      }

      const like = await storage.togglePhotoLike(photoId, isLiked);

      // Get updated like status efficiently
      const allLikes = await storage.getAllPhotoLikes(photoId);
      const likeCount = allLikes.filter((like) => like.isLiked).length;
      const dislikeCount = allLikes.filter((like) => !like.isLiked).length;
      const currentStatus = likeCount > dislikeCount;

      // Create notification asynchronously (don't wait for it)
      const photo = await storage.getPhoto(photoId);
      const gallery = photo ? await storage.getGallery(photo.galleryId) : null;

      if (photo && gallery?.userId) {
        const action = isLiked ? 'geliked' : 'entliked';
        const actorName = userName || 'Anonymer Besucher';
        const actorText = userName || 'Jemand';
        const message = `${actorText} hat Bild "${photo.alt}" in Galerie "${gallery.name}" ${action}`;

        // Create notification async without blocking response
        storage.createNotification({
          userId: gallery.userId,
          galleryId: gallery.id,
          photoId,
          type: 'like',
          message,
          actorName,
          isRead: false
        }).catch(error => console.error('Error creating notification:', error));
      }

      res.json({
        success: true,
        photo: {
          id: photoId,
          isLiked: currentStatus,
          likeCount: likeCount
        }
      });
    } catch (error) {
      console.error("Set like error:", error);
      res.status(500).json({ error: "Fehler beim Speichern des Likes" });
    }
  });

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

  app.post("/api/photos/:photoId/comments", async (req, res) => {
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
        const gallery = photo ? await storage.getGallery(photo.galleryId) : null;

        if (photo && gallery?.userId) {
          const message = `${commenterName} hat einen Kommentar zu Bild "${photo.alt}" in Galerie "${gallery.name}" hinterlassen`;

          console.log('=== COMMENT NOTIFICATION DEBUG ===');
          console.log('Photo:', photo);
          console.log('Gallery:', gallery);
          console.log('Gallery userId:', gallery.userId);
          console.log('Message:', message);

          const notification = await storage.createNotification({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId,
            type: 'comment',
            message,
            actorName: commenterName,
            isRead: false
          });
          console.log('Comment notification created successfully:', notification);
          console.log('=== END COMMENT NOTIFICATION DEBUG ===');
        }
      } catch (notificationError) {
        console.error('Error creating comment notification:', notificationError);
      }

      res.status(201).json({ success: true, commentId });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Fehler beim Erstellen des Kommentars" });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      const success = await storage.deleteComment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Kommentar nicht gefunden" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Fehler beim Löschen des Kommentars" });
    }
  });

  // Notification routes
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await storage.getNotificationsByUserId(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Fehler beim Laden der Benachrichtigungen" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Benachrichtigungs-Daten", details: error.errors });
      }
      console.error("Create notification error:", error);
      res.status(500).json({ error: "Fehler beim Erstellen der Benachrichtigung" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Benachrichtigung nicht gefunden" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ error: "Fehler beim Markieren der Benachrichtigung" });
    }
  });

  app.patch("/api/notifications/:userId/read-all", async (req, res) => {
    try {
      const { userId } = req.params;
      const success = await storage.markAllNotificationsAsRead(userId);
      res.json({ success });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({ error: "Fehler beim Markieren aller Benachrichtigungen" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}