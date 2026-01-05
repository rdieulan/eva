import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import type { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// Generate a JWT token
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

// Verify a JWT token
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// Authentication middleware
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

// Admin role middleware
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  console.log('[AUTH] Admin middleware check - User:', req.user?.email, '- Role:', req.user?.role);
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log('[AUTH] Admin middleware: Access denied - not an admin');
    return res.status(403).json({ error: 'Accès refusé - Admin requis' });
  }
  console.log('[AUTH] Admin middleware: Access granted');
  next();
}

// Login handler
export async function login(req: Request, res: Response) {
  console.log('[AUTH] POST /api/auth/login');
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('[AUTH] Login failed: missing email or password');
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  console.log('[AUTH] Login attempt for:', email);

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log('[AUTH] Login failed: user not found');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('[AUTH] Login failed: invalid password');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Save session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    console.log('[AUTH] Login success:', user.email, '- Role:', user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// Logout handler
export async function logout(req: AuthRequest, res: Response) {
  console.log('[AUTH] POST /api/auth/logout');
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const result = await prisma.session.deleteMany({ where: { token } });
      console.log('[AUTH] Logout success: deleted', result.count, 'session(s)');
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
    }
  } else {
    console.log('[AUTH] Logout: no token provided');
  }

  res.json({ message: 'Déconnecté' });
}

// Get current user handler
export async function getCurrentUser(req: AuthRequest, res: Response) {
  console.log('[AUTH] GET /api/auth/me called');

  if (!req.user) {
    console.log('[AUTH] No user in request');
    return res.status(401).json({ error: 'Non authentifié' });
  }

  console.log('[AUTH] Looking for user:', req.user.userId);

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      console.log('[AUTH] User not found in DB');
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log('[AUTH] User found:', user.name);
    res.json({ user });
  } catch (error) {
    console.error('[AUTH] Get current user error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// Change password handler
export async function changePassword(req: AuthRequest, res: Response) {
  console.log('[AUTH] POST /api/auth/change-password');
  const { currentPassword, newPassword } = req.body;

  if (!req.user) {
    console.log('[AUTH] Change password failed: not authenticated');
    return res.status(401).json({ error: 'Non authentifié' });
  }

  console.log('[AUTH] Change password attempt for:', req.user.email);

  if (!currentPassword || !newPassword) {
    console.log('[AUTH] Change password failed: missing passwords');
    return res.status(400).json({ error: 'Mots de passe requis' });
  }

  if (newPassword.length < 6) {
    console.log('[AUTH] Change password failed: new password too short');
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user) {
      console.log('[AUTH] Change password failed: user not found');
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      console.log('[AUTH] Change password failed: invalid current password');
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword },
    });

    console.log('[AUTH] Change password success for:', req.user.email);
    res.json({ message: 'Mot de passe modifié' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
