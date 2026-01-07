// Authentication routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  generateToken,
  comparePassword,
  hashPassword,
  createSession,
  deleteSession,
  findUserByEmail,
  findUserById,
  updateUserPassword,
} from '../services/auth.service';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  console.log('[AUTH] POST /api/auth/login');
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('[AUTH] Login failed: missing email or password');
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  console.log('[AUTH] Login attempt for:', email);

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      console.log('[AUTH] Login failed: user not found');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const validPassword = await comparePassword(password, user.password);

    if (!validPassword) {
      console.log('[AUTH] Login failed: invalid password');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await createSession(user.id, token);

    console.log('[AUTH] Login success for:', email);
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
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('[AUTH] POST /api/auth/logout - User:', req.user?.email);
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);

  if (token) {
    const count = await deleteSession(token);
    console.log('[AUTH] Logout: Deleted', count, 'session(s)');
  }

  res.json({ message: 'Déconnexion réussie' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('[AUTH] GET /api/auth/me - User:', req.user?.email);
  try {
    const user = await findUserById(req.user!.userId);

    if (!user) {
      console.log('[AUTH] /me: User not found in DB');
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log('[AUTH] /me: Returning user data');
    res.json({ user });
  } catch (error) {
    console.error('[AUTH] /me error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('[AUTH] POST /api/auth/change-password - User:', req.user?.email);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  }

  try {
    const user = await findUserByEmail(req.user!.email);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const validPassword = await comparePassword(currentPassword, user.password);

    if (!validPassword) {
      console.log('[AUTH] Change password failed: invalid current password');
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateUserPassword(user.id, hashedPassword);

    console.log('[AUTH] Password changed successfully for:', req.user?.email);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

