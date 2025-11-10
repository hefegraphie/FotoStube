import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ------------------ TABLES ------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("User"), // "Admin" or "User"
});

export const galleries = pgTable("galleries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references(() => galleries.id, { onDelete: "cascade" }),
  password: text("password"), // Optional password for public access
  createdAt: timestamp("created_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  alt: text("alt").notNull(),
  filePath: text("file_path"),
  thumbnailPath: text("thumbnail_path"),
  mediumPath: text("medium_path"),
  galleryId: uuid("gallery_id")
    .references(() => galleries.id, { onDelete: "cascade" })
    .notNull(),
  rating: integer("rating").default(0), // Single rating 0-5 stars
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const photoLikes = pgTable("photo_likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  photoId: uuid("photo_id")
    .notNull()
    .references(() => photos.id),
  isLiked: boolean("is_liked").notNull().default(false),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  photoId: uuid("photo_id")
    .notNull()
    .references(() => photos.id),
  commenterName: text("commenter_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  galleryId: uuid("gallery_id")
    .references(() => galleries.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id")
    .references(() => photos.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'rating', 'like', 'download', 'comment'
  message: text("message").notNull(),
  actorName: text("actor_name"), // Name of person who performed the action
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const galleryAssignments = pgTable("gallery_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brandingSettings = pgTable("branding_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyName: text("company_name").notNull().default("PhotoGallery"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ------------------ RELATIONS ------------------

export const usersRelations = relations(users, ({ many }) => ({
  galleries: many(galleries),
}));

export const galleriesRelations = relations(galleries, ({ one, many }) => ({
  user: one(users, { fields: [galleries.userId], references: [users.id] }),
  photos: many(photos),
  parent: one(galleries, {
    fields: [galleries.parentId],
    references: [galleries.id],
    relationName: "parentChild"
  }),
  subGalleries: many(galleries, {
    relationName: "parentChild"
  }),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  gallery: one(galleries, {
    fields: [photos.galleryId],
    references: [galleries.id],
  }),
  likes: many(photoLikes),
  comments: many(comments),
}));

export const photoLikesRelations = relations(photoLikes, ({ one }) => ({
  photo: one(photos, { fields: [photoLikes.photoId], references: [photos.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  photo: one(photos, { fields: [comments.photoId], references: [photos.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  gallery: one(galleries, { fields: [notifications.galleryId], references: [galleries.id] }),
  photo: one(photos, { fields: [notifications.photoId], references: [photos.id] }),
}));

export const galleryAssignmentsRelations = relations(galleryAssignments, ({ one }) => ({
  gallery: one(galleries, { fields: [galleryAssignments.galleryId], references: [galleries.id] }),
  user: one(users, { fields: [galleryAssignments.userId], references: [users.id] }),
}));

export const brandingSettingsRelations = relations(brandingSettings, () => ({
  // No direct relations needed for brandingSettings for now
}));

// ------------------ INSERT SCHEMAS ------------------

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

export const insertGallerySchema = createInsertSchema(galleries).omit({
  id: true,
  createdAt: true,
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  createdAt: true,
});

export const insertPhotoLikeSchema = createInsertSchema(photoLikes).omit({
  id: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertGalleryAssignmentSchema = createInsertSchema(galleryAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertBrandingSettingsSchema = createInsertSchema(brandingSettings).omit({
  id: true,
  updatedAt: true,
});

// ------------------ TYPES ------------------

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type Gallery = typeof galleries.$inferSelect;

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;

export type InsertPhotoLike = z.infer<typeof insertPhotoLikeSchema>;
export type PhotoLike = typeof photoLikes.$inferSelect;

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertGalleryAssignment = z.infer<typeof insertGalleryAssignmentSchema>;
export type GalleryAssignment = typeof galleryAssignments.$inferSelect;

export type InsertBrandingSettings = z.infer<typeof insertBrandingSettingsSchema>;
export type BrandingSettings = typeof brandingSettings.$inferSelect;