// Authentication middleware

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] Middleware: Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    console.log('[AUTH] Middleware: Invalid token');
    return res.status(401).json({ error: 'Token invalide' });
  }

  console.log('[AUTH] Middleware: Token valid for user', payload.email);
  req.user = payload;
  next();
}

/**
 * Admin middleware - requires ADMIN role (must be used after authMiddleware)
 */
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  console.log('[AUTH] Admin middleware check - User:', req.user?.email, '- Role:', req.user?.role);
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log('[AUTH] Admin middleware: Access denied - not an admin');
    return res.status(403).json({ error: 'Accès refusé - Admin requis' });
  }
  console.log('[AUTH] Admin middleware: Access granted');
  next();
}

