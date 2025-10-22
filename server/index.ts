import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

const app = express();
app.use(cookieParser());

// Middleware to parse JSON request bodies
app.use(express.json());

// Register all application routes
registerRoutes(app);

// Setup Vite or static serving based on environment
const server = createServer(app);

if (process.env.NODE_ENV === "production") {
	serveStatic(app);
} else {
	await setupVite(app, server);
}

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
	log(`Server is running on http://0.0.0.0:${PORT}`);
});