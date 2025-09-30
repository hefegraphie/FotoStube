import {
  type User,
  type InsertUser,
  type Gallery,
  type InsertGallery,
  type Photo,
  type InsertPhoto,
  type PhotoLike,
  type InsertPhotoLike,
  type Comment,
  type InsertComment,
  type Notification,
  type InsertNotification,
  users,
  galleries,
  photos,
  photoLikes,
  comments,
  notifications
} from "@shared/schema";
import pg from "pg";
const { Pool } = pg;
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, asc, isNull } from "drizzle-orm";

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);
export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Gallery methods
  getGalleriesByUserId(userId: string): Promise<Gallery[]>;
  getMainGalleriesByUserId(userId: string): Promise<Gallery[]>;
  getSubGalleriesByParentId(parentId: string): Promise<Gallery[]>;
  getGallery(id: string): Promise<Gallery | undefined>;
  createGallery(gallery: InsertGallery): Promise<Gallery>;
  updateGallery(id: string, updates: Partial<InsertGallery>): Promise<Gallery | undefined>;
  deleteGallery(id: string): Promise<boolean>;

  // Photo methods
  getPhotosByGalleryId(galleryId: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  deletePhoto(id: string): Promise<boolean>;
  deletePhotos(photoIds: string[]): Promise<boolean>;
  getPhotosWithData(galleryId: string): Promise<any[]>;

  // Rating methods
  setPhotoRating(photoId: string, rating: number): Promise<boolean>;
  setPhotosRating(photoIds: string[], rating: number): Promise<void>;

  // Like methods
  getAllPhotoLikes(photoId: string): Promise<PhotoLike[]>;
  addPhotoLike(photoId: string, isLiked: boolean): Promise<PhotoLike>;

  // Comment methods
  getCommentsByPhotoId(photoId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
  addComment(photoId: string, commenterName: string, text: string): Promise<string>;

  // Notification methods
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Gallery methods
  async getGalleriesByUserId(userId: string): Promise<Gallery[]> {
    return await db.select().from(galleries).where(eq(galleries.userId, userId));
  }

  async getMainGalleriesByUserId(userId: string): Promise<Gallery[]> {
    return await db.select().from(galleries).where(and(eq(galleries.userId, userId), isNull(galleries.parentId)));
  }

  async getSubGalleriesByParentId(parentId: string): Promise<Gallery[]> {
    return await db.select().from(galleries).where(eq(galleries.parentId, parentId)).orderBy(asc(galleries.createdAt));
  }

  async getGallery(id: string): Promise<Gallery | undefined> {
    const result = await db.select().from(galleries).where(eq(galleries.id, id)).limit(1);
    return result[0];
  }

  async createGallery(gallery: InsertGallery): Promise<Gallery> {
    const result = await db.insert(galleries).values(gallery).returning();
    return result[0];
  }

  async updateGallery(id: string, updates: Partial<InsertGallery>): Promise<Gallery | undefined> {
    const result = await db.update(galleries).set(updates).where(eq(galleries.id, id)).returning();
    return result[0];
  }

  async deleteGallery(id: string): Promise<boolean> {
    try {
      // First get all sub-galleries and delete them recursively
      const subGalleries = await db.select().from(galleries).where(eq(galleries.parentId, id));
      for (const subGallery of subGalleries) {
        await this.deleteGallery(subGallery.id); // Recursive deletion
      }

      // Then get all photos in the gallery
      const galleryPhotos = await db.select().from(photos).where(eq(photos.galleryId, id));

      // Delete all photos and their dependencies
      for (const photo of galleryPhotos) {
        // Delete comments for this photo
        await db.delete(comments).where(eq(comments.photoId, photo.id));
        // Delete likes for this photo
        await db.delete(photoLikes).where(eq(photoLikes.photoId, photo.id));
        // Delete notifications for this photo
        await db.delete(notifications).where(eq(notifications.photoId, photo.id));
        // Delete the photo itself
        await db.delete(photos).where(eq(photos.id, photo.id));
      }

      // Delete notifications for this gallery
      await db.delete(notifications).where(eq(notifications.galleryId, id));

      // Finally delete the gallery
      const result = await db.delete(galleries).where(eq(galleries.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting gallery:', error);
      return false;
    }
  }

  // Photo methods
  async getPhotosByGalleryId(galleryId: string): Promise<Photo[]> {
    return await db.select().from(photos).where(eq(photos.galleryId, galleryId)).orderBy(asc(photos.createdAt));
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const result = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
    return result[0];
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    const result = await db.insert(photos).values(photo).returning();
    return result[0];
  }

  async deletePhoto(id: string): Promise<boolean> {
    // First delete all comments for this photo to avoid foreign key constraint
    await db.delete(comments).where(eq(comments.photoId, id));

    // Then delete all likes for this photo
    await db.delete(photoLikes).where(eq(photoLikes.photoId, id));

    // Finally delete the photo itself
    const result = await db.delete(photos).where(eq(photos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deletePhotos(photoIds: string[]): Promise<boolean> {
    if (photoIds.length === 0) return true;

    try {
      // Delete related data for all photos
      for (const photoId of photoIds) {
        await db.delete(comments).where(eq(comments.photoId, photoId));
        await db.delete(photoLikes).where(eq(photoLikes.photoId, photoId));
        await db.delete(photos).where(eq(photos.id, photoId));
      }

      return true;
    } catch (error) {
      console.error('Error deleting photos:', error);
      return false;
    }
  }

  async getPhotosWithData(galleryId: string): Promise<any[]> {
    const galleryPhotos = await db.select().from(photos).where(eq(photos.galleryId, galleryId)).orderBy(asc(photos.createdAt));

    const photosWithAllData = await Promise.all(
      galleryPhotos.map(async (photo) => {
        // Get likes and count
        const photoLikesData = await db.select().from(photoLikes).where(eq(photoLikes.photoId, photo.id));
        const likeCount = photoLikesData.filter(like => like.isLiked).length;
        const dislikeCount = photoLikesData.filter(like => !like.isLiked).length;

        // Calculate current like status (more likes than dislikes = liked)
        const currentLikeStatus = likeCount > dislikeCount;

        // Get comments
        const photoComments = await db.select().from(comments).where(eq(comments.photoId, photo.id));

        return {
          ...photo,
          src: photo.thumbnailPath ? `/${photo.thumbnailPath}` : `/${photo.filePath}`, // Always use thumbnail for gallery view
          mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : `/${photo.filePath}`, // For lightbox
          originalSrc: `/${photo.filePath}`, // For downloads
          rating: photo.rating || 0,
          isLiked: currentLikeStatus,
          likeCount: likeCount,
          comments: photoComments.map(comment => ({
            id: comment.id,
            author: comment.commenterName,
            text: comment.text,
            timestamp: comment.createdAt ? new Date(comment.createdAt).toLocaleString('de-DE') : 'Unbekannt'
          }))
        };
      })
    );

    return photosWithAllData;
  }

  // Rating methods
  async setPhotoRating(photoId: string, rating: number): Promise<boolean> {
    const result = await db.update(photos).set({ rating: rating }).where(eq(photos.id, photoId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async setPhotosRating(photoIds: string[], rating: number): Promise<void> {
    for (const photoId of photoIds) {
      await db.update(photos).set({ rating: rating }).where(eq(photos.id, photoId));
    }
  }

  // Like methods
  async getAllPhotoLikes(photoId: string): Promise<PhotoLike[]> {
    return await db.select().from(photoLikes).where(eq(photoLikes.photoId, photoId));
  }

  async addPhotoLike(photoId: string, isLiked: boolean): Promise<PhotoLike> {
    const result = await db
      .insert(photoLikes)
      .values({
        photoId,
        isLiked,
      })
      .returning();
    return result[0];
  }

  // Comment methods
  async getCommentsByPhotoId(photoId: string): Promise<Comment[]> {
    return await db.select().from(comments).where(eq(comments.photoId, photoId));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(comment).returning();
    return result[0];
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async addComment(photoId: string, commenterName: string, text: string): Promise<string> {
    const result = await db
      .insert(comments)
      .values({
        photoId,
        commenterName,
        text,
      })
      .returning({ id: comments.id });

    return result[0].id;
  }

  // Notification methods
  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(asc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    console.log('=== CREATE NOTIFICATION DEBUG ===');
    console.log('Input notification data:', notification);
    try {
      const result = await db.insert(notifications).values(notification).returning();
      console.log('Successfully created notification:', result[0]);
      console.log('=== END CREATE NOTIFICATION DEBUG ===');
      return result[0];
    } catch (error) {
      console.error('Database error creating notification:', error);
      throw error;
    }
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();