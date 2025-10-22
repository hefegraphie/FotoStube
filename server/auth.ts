
import jwt from 'jsonwebtoken';
import { type Request, type Response, type NextFunction } from 'express';

// Ensure JWT secret is set in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production environment!');
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token gültig für 7 Tage

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

// JWT Token generieren
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// JWT Token verifizieren
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Middleware: JWT aus Cookie oder Authorization Header extrahieren und verifizieren
export function authenticateJWT(req: any, res: Response, next: NextFunction) {
  // Token aus Cookie holen
  let token = req.cookies?.authToken;
  
  // Fallback: Token aus Authorization Header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Nicht authentifiziert - kein Token' });
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
  }

  // User-Daten an Request anhängen
  req.user = payload;
  next();
}

// Middleware: Nur Admin-Zugriff
export function requireAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Keine Berechtigung - Admin-Rechte erforderlich' });
  }

  next();
}

// Middleware: Ownership prüfen (z.B. für Galerien)
export async function requireGalleryOwnership(storage: any) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const galleryId = req.params.galleryId || req.params.id;
    if (!galleryId) {
      return res.status(400).json({ error: 'Galerie-ID fehlt' });
    }

    const gallery = await storage.getGallery(galleryId);
    
    if (!gallery) {
      return res.status(404).json({ error: 'Galerie nicht gefunden' });
    }

    // Admin hat immer Zugriff
    if (req.user.role === 'Admin') {
      return next();
    }

    // Prüfe ob User der Besitzer ist
    if (gallery.userId !== req.user.userId) {
      // Prüfe ob Galerie dem User zugewiesen ist
      const assignments = await storage.getGalleryAssignments(galleryId);
      const isAssigned = assignments.some((a: any) => a.userId === req.user.userId);
      
      if (!isAssigned) {
        return res.status(403).json({ error: 'Keine Berechtigung für diese Galerie' });
      }
    }

    next();
  };
}
