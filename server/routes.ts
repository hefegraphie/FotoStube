import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import path from "path";

import { registerSetupRoutes } from "./setupRoutes";
import { registerAuthRoutes } from "./authRoutes";
import { registerUsersRoutes } from "./usersRoutes";
import { registerPublicRoutes } from "./publicRoutes";
import { registerGalleriesRoutes } from "./galleriesRoutes";
import { registerDownloadsRoutes } from "./downloadsRoutes";
import { registerNotificationsRoutes } from "./notificationsRoutes";

// Register all application routes
export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Route groups are registered in explicit, stable order so that
  // Express route matching behaves identically regardless of module layout.
  await registerSetupRoutes(app);
  await registerAuthRoutes(app);
  await registerUsersRoutes(app);
  await registerPublicRoutes(app);
  await registerGalleriesRoutes(app);
  await registerDownloadsRoutes(app);
  await registerNotificationsRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}