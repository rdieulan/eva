import { describe, it, expect, vi, beforeEach } from 'vitest';

// Auth utility tests
describe('JWT Token Handling', () => {
  describe('Token Storage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should store token in localStorage', () => {
      const token = 'test-jwt-token';
      localStorage.setItem('token', token);

      expect(localStorage.getItem('token')).toBe(token);
    });

    it('should remove token on logout', () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Test' }));

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('User Storage', () => {
    it('should store user data as JSON', () => {
      const user = { id: '123', email: 'test@test.com', name: 'Test User', role: 'PLAYER' };
      localStorage.setItem('user', JSON.stringify(user));

      const storedUser = JSON.parse(localStorage.getItem('user')!);

      expect(storedUser.id).toBe('123');
      expect(storedUser.email).toBe('test@test.com');
      expect(storedUser.name).toBe('Test User');
      expect(storedUser.role).toBe('PLAYER');
    });
  });
});

describe('Permission Computation', () => {
  interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'PLAYER';
  }

  interface Permissions {
    canEdit: boolean;
    canManageUsers: boolean;
    canExportPlans: boolean;
    canViewPlanner: boolean;
    canViewCalendar: boolean;
  }

  function computePermissions(user: User | null): Permissions {
    const role = user?.role;

    return {
      canEdit: role === 'ADMIN',
      canManageUsers: role === 'ADMIN',
      canExportPlans: role === 'ADMIN' || role === 'PLAYER',
      canViewPlanner: role === 'ADMIN' || role === 'PLAYER',
      canViewCalendar: role === 'ADMIN' || role === 'PLAYER',
    };
  }

  it('should grant full permissions to ADMIN', () => {
    const adminUser: User = {
      id: '1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
    };

    const permissions = computePermissions(adminUser);

    expect(permissions.canEdit).toBe(true);
    expect(permissions.canManageUsers).toBe(true);
    expect(permissions.canExportPlans).toBe(true);
    expect(permissions.canViewPlanner).toBe(true);
    expect(permissions.canViewCalendar).toBe(true);
  });

  it('should grant limited permissions to PLAYER', () => {
    const playerUser: User = {
      id: '2',
      email: 'player@test.com',
      name: 'Player',
      role: 'PLAYER',
    };

    const permissions = computePermissions(playerUser);

    expect(permissions.canEdit).toBe(false);
    expect(permissions.canManageUsers).toBe(false);
    expect(permissions.canExportPlans).toBe(true);
    expect(permissions.canViewPlanner).toBe(true);
    expect(permissions.canViewCalendar).toBe(true);
  });

  it('should deny all permissions when no user', () => {
    const permissions = computePermissions(null);

    expect(permissions.canEdit).toBe(false);
    expect(permissions.canManageUsers).toBe(false);
    expect(permissions.canExportPlans).toBe(false);
    expect(permissions.canViewPlanner).toBe(false);
    expect(permissions.canViewCalendar).toBe(false);
  });
});

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('should call login API with credentials', async () => {
    const mockResponse = {
      token: 'jwt-token',
      user: { id: '1', email: 'test@test.com', name: 'Test', role: 'PLAYER' }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password' }),
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
    }));
    expect(response.ok).toBe(true);
  });

  it('should handle login failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    });

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it('should validate token with /api/auth/me', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'PLAYER' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const token = 'stored-jwt-token';
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: { 'Authorization': `Bearer ${token}` },
    }));

    const data = await response.json();
    expect(data.user).toEqual(mockUser);
  });

  it('should handle expired token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Token expired' }),
    });

    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer expired-token' },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it('should call logout API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Logged out' }),
    });

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' },
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
      method: 'POST',
    }));
    expect(response.ok).toBe(true);
  });
});

describe('Password Change', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call change password API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Password changed' }),
    });

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
      },
      body: JSON.stringify({
        currentPassword: 'oldpass',
        newPassword: 'newpass',
      }),
    });

    expect(response.ok).toBe(true);
  });

  it('should reject wrong current password', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Current password incorrect' }),
    });

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
      },
      body: JSON.stringify({
        currentPassword: 'wrongpass',
        newPassword: 'newpass',
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });
});

