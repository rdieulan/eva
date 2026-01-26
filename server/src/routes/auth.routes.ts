// Authentication routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import {
  generateToken,
  comparePassword,
  hashPassword,
  createSession,
  deleteSession,
  findUserByEmail,
  findUserById,
  updateUserPassword,
  buildAuthUserData,
  createUser,
  validateEmail,
  validatePassword,
  validateName,
} from '@services/auth.service';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  console.log('[AUTH] POST /api/auth/register');
  const { email, password, name } = req.body;

  // Validation
  if (!email || !password || !name) {
    console.log('[AUTH] Register failed: missing fields');
    return res.status(400).json({ errors: ['Email, mot de passe et pseudo requis'] });
  }

  const emailValid = validateEmail(email);
  if (emailValid !== true) {
    console.log('[AUTH] Register failed: invalid email format');
    return res.status(400).json({ errors: emailValid });
  }

  const passwordValid = validatePassword(password);
  if (passwordValid !== true) {
    console.log('[AUTH] Register failed: password validation failed');
    return res.status(400).json({ errors: passwordValid });
  }

  const nameValid = validateName(name);
  if (nameValid !== true) {
    console.log('[AUTH] Register failed: name validation failed');
    return res.status(400).json({ errors: nameValid });
  }

  try {
    // Check if email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      console.log('[AUTH] Register failed: email already exists');
      return res.status(409).json({ errors: ['Cette adresse email est déjà utilisée'] });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await createUser(email, hashedPassword, name.trim());

    console.log('[AUTH] Register success for:', email);
    res.status(201).json({
      message: 'Compte créé avec succès',
      userId: user.id,
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  console.log('[AUTH] POST /api/auth/login');
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('[AUTH] Login failed: missing email or password');
    return res.status(400).json({ errors: ['Email et mot de passe requis'] });
  }

  console.log('[AUTH] Login attempt for:', email);

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      console.log('[AUTH] Login failed: user not found');
      return res.status(401).json({ errors: ['Identifiants invalides'] });
    }

    const validPassword = await comparePassword(password, user.password);

    if (!validPassword) {
      console.log('[AUTH] Login failed: invalid password');
      return res.status(401).json({ errors: ['Identifiants invalides'] });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    await createSession(user.id, token);

    const authUser = await buildAuthUserData(user);

    console.log('[AUTH] Login success for:', email);
    res.json({
      token,
      user: authUser,
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
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
      return res.status(404).json({ errors: ['Utilisateur non trouvé'] });
    }

    console.log('[AUTH] /me: Returning user data');
    res.json({ user });
  } catch (error) {
    console.error('[AUTH] /me error:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('[AUTH] POST /api/auth/change-password - User:', req.user?.email);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ errors: ['Mot de passe actuel et nouveau requis'] });
  }

  const passwordValid = validatePassword(newPassword);
  if (passwordValid !== true) {
    return res.status(400).json({ errors: passwordValid });
  }

  try {
    const user = await findUserByEmail(req.user!.email);

    if (!user) {
      return res.status(404).json({ errors: ['Utilisateur non trouvé'] });
    }

    const validPassword = await comparePassword(currentPassword, user.password);

    if (!validPassword) {
      console.log('[AUTH] Change password failed: invalid current password');
      return res.status(401).json({ errors: ['Mot de passe actuel incorrect'] });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateUserPassword(user.id, hashedPassword);

    console.log('[AUTH] Password changed successfully for:', req.user?.email);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

export default router;

