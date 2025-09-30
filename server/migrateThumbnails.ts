
import { storage } from './storage';
import { ThumbnailGenerator } from './thumbnailGenerator';
import fs from 'fs';

async function migrateThumbnails() {
  console.log('Starting thumbnail migration...');
  
  try {
    // Get all photos from database
    const allPhotos = await storage.db.select().from(storage.photos);
    
    console.log(`Found ${allPhotos.length} photos to migrate`);
    
    for (const photo of allPhotos) {
      if (photo.thumbnailPath && photo.mediumPath) {
        console.log(`Skipping ${photo.filename} - thumbnails already exist`);
        continue;
      }
      
      const originalPath = photo.filePath || `uploads/galleries/${photo.galleryId}/${photo.filename}`;
      
      if (!fs.existsSync(originalPath)) {
        console.warn(`Original file not found: ${originalPath}`);
        continue;
      }
      
      try {
        console.log(`Generating thumbnails for ${photo.filename}...`);
        
        const thumbnailPaths = await ThumbnailGenerator.generateThumbnails(
          originalPath,
          photo.filename,
          photo.galleryId
        );
        
        // Update database with thumbnail paths
        await storage.db.update(storage.photos)
          .set({
            thumbnailPath: thumbnailPaths.thumbnail,
            mediumPath: thumbnailPaths.medium,
            filePath: thumbnailPaths.original
          })
          .where(storage.eq(storage.photos.id, photo.id));
          
        console.log(`✓ Generated thumbnails for ${photo.filename}`);
        
      } catch (error) {
        console.error(`✗ Error generating thumbnails for ${photo.filename}:`, error);
      }
    }
    
    console.log('Thumbnail migration completed!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateThumbnails().then(() => process.exit(0));
}

export { migrateThumbnails };
