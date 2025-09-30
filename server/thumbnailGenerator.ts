
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface ThumbnailSizes {
  thumbnail: { maxHeight: 500, quality: 85 };
  medium: { maxHeight: 1800, quality: 90 };
}

export const THUMBNAIL_SIZES: ThumbnailSizes = {
  thumbnail: { maxHeight: 500, quality: 85 },
  medium: { maxHeight: 1800, quality: 90 }
};

export class ThumbnailGenerator {
  static ensureThumbnailDirectories(galleryId: string) {
    const baseDir = `uploads/galleries/${galleryId}`;
    const thumbDir = `uploads/galleries/thumbnails/${galleryId}`;
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }
  }

  static async generateThumbnails(
    originalPath: string, 
    filename: string, 
    galleryId: string
  ): Promise<{
    thumbnail: string;
    medium: string;
    original: string;
  }> {
    this.ensureThumbnailDirectories(galleryId);

    const baseDir = `uploads/galleries/${galleryId}`;
    const thumbDir = `uploads/galleries/thumbnails/${galleryId}`;
    
    // Parse filename to get name and extension
    const parsedPath = path.parse(filename);
    const baseName = parsedPath.name;
    const ext = parsedPath.ext;

    // Define paths
    const thumbnailPath = path.join(thumbDir, `${baseName}_thumb${ext}`);
    const mediumPath = path.join(thumbDir, `${baseName}_medium${ext}`);
    const originalFinalPath = path.join(baseDir, filename);

    try {
      // Generate thumbnail (max 500px height)
      await sharp(originalPath)
        .resize({ 
          height: THUMBNAIL_SIZES.thumbnail.maxHeight, 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: THUMBNAIL_SIZES.thumbnail.quality })
        .toFile(thumbnailPath);

      // Generate medium size (max 1800px height)
      await sharp(originalPath)
        .resize({ 
          height: THUMBNAIL_SIZES.medium.maxHeight, 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: THUMBNAIL_SIZES.medium.quality })
        .toFile(mediumPath);

      // Move original to final location if it's not already there
      if (originalPath !== originalFinalPath) {
        fs.renameSync(originalPath, originalFinalPath);
      }

      return {
        thumbnail: thumbnailPath,
        medium: mediumPath,
        original: originalFinalPath
      };
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      throw error;
    }
  }

  static getThumbnailPaths(filename: string, galleryId: string) {
    const parsedPath = path.parse(filename);
    const baseName = parsedPath.name;
    const ext = parsedPath.ext;
    
    return {
      thumbnail: `uploads/galleries/thumbnails/${galleryId}/${baseName}_thumb${ext}`,
      medium: `uploads/galleries/thumbnails/${galleryId}/${baseName}_medium${ext}`,
      original: `uploads/galleries/${galleryId}/${filename}`
    };
  }

  static async deleteThumbnails(filename: string, galleryId: string) {
    const paths = this.getThumbnailPaths(filename, galleryId);
    
    // Delete thumbnail files if they exist
    try {
      if (fs.existsSync(paths.thumbnail)) {
        fs.unlinkSync(paths.thumbnail);
      }
      if (fs.existsSync(paths.medium)) {
        fs.unlinkSync(paths.medium);
      }
      if (fs.existsSync(paths.original)) {
        fs.unlinkSync(paths.original);
      }
    } catch (error) {
      console.error('Error deleting thumbnails:', error);
    }
  }
}
