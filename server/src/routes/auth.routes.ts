// Authentication routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { authLogger } from '@utils/logger';
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
  buildAccountData,
  validateEmail,
  validatePassword,
  validateName,
  findAccountByActivationToken,
  activateAccount,
  findUserByPasswordResetToken,
  applyPasswordReset,
  linkAccounts,
  getLinkedAccounts,
  isAccountInSameGroup,
} from '@services/auth.service';
import { createPlayer } from '@services/player.service';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  authLogger.debug('POST /api/auth/register');
  const { email, password, name } = req.body;

  // Validation
  if (!email || !password || !name) {
    authLogger.debug('Register failed: missing fields');
    return res.status(400).json({ errors: [ERROR.emailPasswordNameRequired] });
  }

  const emailValid = validateEmail(email);
  if (emailValid !== true) {
    authLogger.debug('Register failed: invalid email format');
    return res.status(400).json({ errors: emailValid });
  }

  const passwordValid = validatePassword(password);
  if (passwordValid !== true) {
    authLogger.debug('Register failed: password validation failed');
    return res.status(400).json({ errors: passwordValid });
  }

  const nameValid = validateName(name);
  if (nameValid !== true) {
    authLogger.debug('Register failed: name validation failed');
    return res.status(400).json({ errors: nameValid });
  }

  try {
    // Check if email already exists
    if (await emailExists(email)) {
      authLogger.debug('Register failed: email already exists');
      return res.status(409).json({ errors: [ERROR.emailAlreadyUsed] });
    }

    // Create player account
    const hashedPassword = await hashPassword(password);
    const user = await createPlayer(email, hashedPassword, name.trim());

    authLogger.debug('Register success for:', email);
    res.status(201).json({
      message: 'Compte créé avec succès',
      userId: user.id,
      playerId: user.player!.id,
    });
  } catch (error) {
    authLogger.error('Register error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  authLogger.debug('POST /api/auth/login');
  const { email, password } = req.body;

  if (!email || !password) {
    authLogger.debug('Login failed: missing email or password');
    return res.status(400).json({ errors: [ERROR.emailAndPasswordRequired] });
  }

  authLogger.debug('Login attempt for:', email);

  try {
    const account = await findAccountByEmail(email);

    if (!account) {
      authLogger.debug('Login failed: account not found');
      return res.status(401).json({ errors: [ERROR.loginFailed] });
    }

    const validPassword = await comparePassword(password, account.password);

    if (!validPassword) {
      authLogger.debug('Login failed: invalid password');
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

    const authAccount = await buildAccountData(account);

    authLogger.debug('Login success for:', email);
    res.json({
      token,
      account: authAccount,
    });
  } catch (error) {
    authLogger.error('Login error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  authLogger.debug('POST /api/auth/logout - Account:', req.account?.email);
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);

  if (token) {
    const count = await deleteSession(token);
    authLogger.debug('Logout: Deleted', count, 'session(s)');
  }

  res.json({ message: 'Déconnexion réussie' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  authLogger.debug('GET /api/auth/me - Account:', req.account?.email);
  try {
    const account = await getAccountById(req.account!.userId);

    if (!account) {
      authLogger.debug('/me: Account not found in DB');
      return res.status(404).json({ errors: [ERROR.userNotFound] });
    }

    authLogger.debug('/me: Returning account data');
    res.json({ account });
  } catch (error) {
    authLogger.error('/me error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  authLogger.debug('POST /api/auth/change-password - Account:', req.account?.email);
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
      authLogger.debug('Change password failed: invalid current password');
      return res.status(401).json({ errors: [ERROR.currentPasswordIncorrect] });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateAccountPassword(account.id, hashedPassword);

    authLogger.debug('Password changed successfully for:', req.account?.email);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    authLogger.error('Change password error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/activate - Activate manager account with password
router.post('/activate', async (req: Request, res: Response) => {
  authLogger.debug('POST /api/auth/activate');
  const { token, password } = req.body;

  if (!token) {
    return res.status(400).json({ errors: [ERROR.activationTokenRequired] });
  }

  if (!password) {
    return res.status(400).json({ errors: [ERROR.passwordRequired] });
  }

  const passwordValid = validatePassword(password);
  if (passwordValid !== true) {
    return res.status(400).json({ errors: passwordValid });
  }

  try {
    const lookup = await findAccountByActivationToken(token);

    if (!lookup) {
      return res.status(400).json({ errors: [ERROR.activationTokenInvalid] });
    }

    const hashedPassword = await hashPassword(password);
    await activateAccount(lookup, hashedPassword);

    authLogger.debug('Account activated successfully:', lookup.kind, lookup.userId);
    res.json({ message: 'Compte activé avec succès' });
  } catch (error) {
    authLogger.error('Activation error:', error);
    res.status(500).json({ errors: [ERROR.activationFailed] });
  }
});

// POST /api/auth/reset-password - Use an admin-issued reset token to set a new password
router.post('/reset-password', async (req: Request, res: Response) => {
  authLogger.debug('POST /api/auth/reset-password');
  const { token, password } = req.body;

  if (!token) {
    return res.status(400).json({ errors: [ERROR.passwordResetTokenRequired] });
  }

  if (!password) {
    return res.status(400).json({ errors: [ERROR.passwordRequired] });
  }

  const passwordValid = validatePassword(password);
  if (passwordValid !== true) {
    return res.status(400).json({ errors: passwordValid });
  }

  try {
    const user = await findUserByPasswordResetToken(token);

    if (!user) {
      return res.status(400).json({ errors: [ERROR.passwordResetTokenInvalid] });
    }

    const hashedPassword = await hashPassword(password);
    await applyPasswordReset(user.id, hashedPassword);

    authLogger.debug('Password reset successfully for:', user.email);
    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    authLogger.error('Password reset error:', error);
    res.status(500).json({ errors: [ERROR.passwordResetFailed] });
  }
});

// POST /api/auth/link-account - Link current account to another
router.post('/link-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  authLogger.debug('POST /api/auth/link-account');
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ errors: [ERROR.linkedAccountCredentialsRequired] });
  }

  try {
    // Find the account to link
    const targetAccount = await findAccountByEmail(email);

    if (!targetAccount) {
      return res.status(401).json({ errors: [ERROR.loginFailed] });
    }

    // Verify password
    const validPassword = await comparePassword(password, targetAccount.password);
    if (!validPassword) {
      return res.status(401).json({ errors: [ERROR.loginFailed] });
    }

    // Check not linking to self
    if (targetAccount.id === req.account!.userId) {
      return res.status(400).json({ errors: [ERROR.cannotLinkSameAccount] });
    }

    // Link the accounts
    const { groupId } = await linkAccounts(req.account!.userId, targetAccount.id);

    authLogger.debug('Accounts linked successfully, group:', groupId);
    res.json({ message: 'Comptes liés avec succès', groupId });
  } catch (error) {
    authLogger.error('Link account error:', error);
    res.status(500).json({ errors: [ERROR.linkAccountFailed] });
  }
});

// GET /api/auth/linked-accounts - Get all linked accounts
router.get('/linked-accounts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const linkedAccounts = await getLinkedAccounts(req.account!.userId);
    res.json(linkedAccounts);
  } catch (error) {
    authLogger.error('Get linked accounts error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/switch-account - Switch to another linked account
router.post('/switch-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  authLogger.debug('POST /api/auth/switch-account');
  const { targetAccountId } = req.body;

  if (!targetAccountId) {
    return res.status(400).json({ errors: [ERROR.targetAccountIdRequired] });
  }

  try {
    // Verify target is in same linked group
    const inSameGroup = await isAccountInSameGroup(req.account!.userId, targetAccountId);

    if (!inSameGroup) {
      return res.status(403).json({ errors: [ERROR.accountNotInGroup] });
    }

    // Get target account data
    const targetAccount = await getAccountById(targetAccountId);

    if (!targetAccount) {
      return res.status(404).json({ errors: [ERROR.userNotFound] });
    }

    // Generate new token for target account
    const token = generateToken({
      userId: targetAccount.id,
      playerId: targetAccount.playerId ?? undefined,
      managerId: targetAccount.managerId ?? undefined,
      adminId: targetAccount.adminId ?? undefined,
      email: targetAccount.email,
      teamId: targetAccount.teamId ?? undefined,
    });

    await createSession(targetAccount.id, token);

    authLogger.debug('Account switched to:', targetAccount.email);
    res.json({
      token,
      account: targetAccount,
    });
  } catch (error) {
    authLogger.error('Switch account error:', error);
    res.status(500).json({ errors: [ERROR.switchAccountFailed] });
  }
});

export default router;

