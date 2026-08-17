import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

export const ensureUploadDirs = () => {
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

export const upload = multer({
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
