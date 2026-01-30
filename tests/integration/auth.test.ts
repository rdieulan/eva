// Integration tests - Authentication routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createTestUser, isValidJwtFormat } from './helpers/auth';
import { prisma } from './helpers/db';
import { PASSWORD_MIN_LENGTH, NAME_MIN_LENGTH } from '@shared/utils/validation.utils';
import { ERROR } from '@shared/constants/error.constants';

// Valid test data based on validation rules
const VALID_PASSWORD = 'A' + '1' + 'a'.repeat(PASSWORD_MIN_LENGTH - 2);
const VALID_NAME = 'x'.repeat(NAME_MIN_LENGTH);
const INVALID_PASSWORD_TOO_SHORT = 'A1' + 'a'.repeat(PASSWORD_MIN_LENGTH - 4); // Too short
const INVALID_NAME_TOO_SHORT = 'x'.repeat(NAME_MIN_LENGTH - 1); // Too short

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: VALID_PASSWORD,
          name: VALID_NAME,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('userId');
      expect(typeof res.body.userId).toBe('string');
      expect(res.body.userId.length).toBeGreaterThan(0);

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'newuser@example.com' },
      });
      expect(user).not.toBeNull();
      expect(user?.name).toBe(VALID_NAME);
    });

    it('should reject registration with existing email', async () => {
      // Create a user first
      await createTestUser({ email: 'existing@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: VALID_PASSWORD,
          name: VALID_NAME,
        });

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.emailAlreadyUsed);
    });

    it('should reject registration with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: INVALID_PASSWORD_TOO_SHORT,
          name: VALID_NAME,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.passwordTooShort);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: VALID_PASSWORD,
          name: VALID_NAME,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.emailInvalid);
    });

    it('should reject registration with invalid username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: VALID_PASSWORD,
          name: INVALID_NAME_TOO_SHORT,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.nameTooShort);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Create a user with known password
      await createTestUser({
        email: 'login@example.com',
        password: VALID_PASSWORD,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: VALID_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('login@example.com');

      // Verify token is a valid JWT format
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(isValidJwtFormat(res.body.token)).toBe(true);
    });

    it('should login with email case-insensitive', async () => {
      await createTestUser({
        email: 'CaseTest@Example.com',
        password: VALID_PASSWORD,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'casetest@example.com', // Different case
          password: VALID_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should reject login with wrong password', async () => {
      const correctPassword = VALID_PASSWORD;
      const wrongPassword = VALID_PASSWORD + 'wrong';

      await createTestUser({
        email: 'wrongpass@example.com',
        password: correctPassword,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpass@example.com',
          password: wrongPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.loginFailed);
    });

    it('should reject login with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: VALID_PASSWORD,
        });

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.loginFailed);
    });

    it('should return same error for wrong email and wrong password (security)', async () => {
      const correctPassword = VALID_PASSWORD;
      const wrongPassword = VALID_PASSWORD + 'wrong';

      await createTestUser({
        email: 'security@example.com',
        password: correctPassword,
      });

      const wrongEmailRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongemail@example.com',
          password: correctPassword,
        });

      const wrongPassRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'security@example.com',
          password: wrongPassword,
        });

      // Both should return 401 with same error message (no info leak)
      expect(wrongEmailRes.status).toBe(401);
      expect(wrongPassRes.status).toBe(401);
      expect(wrongEmailRes.body.errors).toContain(ERROR.loginFailed);
      expect(wrongPassRes.body.errors).toContain(ERROR.loginFailed);
    });
  });
});
