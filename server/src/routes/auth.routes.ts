// Authentication routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import {
  generateToken,
  comparePassword,
  hashPassword,
  createSession,
  deleteSession,
  emailExists,
  findAccountByEmail,
  getAccountById,
  updateAccountPassword,
  buildAuthAccountData,
  validateEmail,
  validatePassword,
  validateName,
} from '@services/auth.service';
import { createPlayer } from '@services/player.service';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  console.log('[AUTH] POST /api/auth/register');
  const { email, password, name } = req.body;

  // Validation
  if (!email || !password || !name) {
    console.log('[AUTH] Register failed: missing fields');
    return res.status(400).json({ errors: [ERROR.emailPasswordNameRequired] });
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
    if (await emailExists(email)) {
      console.log('[AUTH] Register failed: email already exists');
      return res.status(409).json({ errors: [ERROR.emailAlreadyUsed] });
    }

    // Create player account
    const hashedPassword = await hashPassword(password);
    const user = await createPlayer(email, hashedPassword, name.trim());

    console.log('[AUTH] Register success for:', email);
    res.status(201).json({
      message: 'Compte créé avec succès',
      userId: user.id,
      playerId: user.player!.id,
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  console.log('[AUTH] POST /api/auth/login');
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('[AUTH] Login failed: missing email or password');
    return res.status(400).json({ errors: [ERROR.emailAndPasswordRequired] });
  }

  console.log('[AUTH] Login attempt for:', email);

  try {
    const account = await findAccountByEmail(email);

    if (!account) {
      console.log('[AUTH] Login failed: account not found');
      return res.status(401).json({ errors: [ERROR.loginFailed] });
    }

    const validPassword = await comparePassword(password, account.password);

    if (!validPassword) {
      console.log('[AUTH] Login failed: invalid password');
      return res.status(401).json({ errors: [ERROR.loginFailed] });
    }

    // Determine account type and specific ID
    const accountType = account.admin ? 'admin' : account.manager ? 'manager' : 'player';
    const token = generateToken({
      userId: account.id,
      email: account.email,
      accountType,
      playerId: account.player?.id,
      managerId: account.manager?.id,
      adminId: account.admin?.id,
    });

    await createSession(account.id, token);

    const authAccount = await buildAuthAccountData(account);

    console.log('[AUTH] Login success for:', email);
    res.json({
      token,
      user: authAccount,
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('[AUTH] POST /api/auth/logout - Account:', req.account?.email);
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
  console.log('[AUTH] GET /api/auth/me - Account:', req.account?.email);
  try {
    const account = await getAccountById(req.account!.userId);

    if (!account) {
      console.log('[AUTH] /me: Account not found in DB');
      return res.status(404).json({ errors: [ERROR.userNotFound] });
    }

    console.log('[AUTH] /me: Returning account data');
    res.json({ user: account });
  } catch (error) {
    console.error('[AUTH] /me error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('[AUTH] POST /api/auth/change-password - Account:', req.account?.email);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ errors: [ERROR.currentAndNewPasswordRequired] });
  }

  const passwordValid = validatePassword(newPassword);
  if (passwordValid !== true) {
    return res.status(400).json({ errors: passwordValid });
  }

  try {
    const account = await findAccountByEmail(req.account!.email);

    if (!account) {
      return res.status(404).json({ errors: [ERROR.userNotFound] });
    }

    const validPassword = await comparePassword(currentPassword, account.password);

    if (!validPassword) {
      console.log('[AUTH] Change password failed: invalid current password');
      return res.status(401).json({ errors: [ERROR.currentPasswordIncorrect] });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateAccountPassword(account.id, hashedPassword);

    console.log('[AUTH] Password changed successfully for:', req.account?.email);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;

