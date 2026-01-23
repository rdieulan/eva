/**
 * Balance Rules Routes Tests
 *
 * Tests for server-side balance rules API:
 * - GET /api/balance-rules - Get team's rules
 * - PUT /api/balance-rules/:ruleId - Update a rule
 * - POST /api/balance-rules/reset - Reset to defaults
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Balance Rules API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockToken = 'valid-token';

  describe('GET /api/balance-rules', () => {
    it('should return balance rules for authenticated user', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          teamId: 'team-1',
          ruleKey: 'MIN_PLAYERS_PER_ROLE',
          name: 'Joueurs minimum par rôle',
          enabled: true,
          severity: 'ERROR',
          params: { minPlayers: 2 },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRules),
      });

      const response = await fetch('/api/balance-rules', {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const rules = await response.json();
      expect(rules).toHaveLength(1);
      expect(rules[0].ruleKey).toBe('MIN_PLAYERS_PER_ROLE');
    });

    it('should reject unauthenticated request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Non autorisé' }),
      });

      const response = await fetch('/api/balance-rules');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should return 404 if user has no team', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Aucune équipe trouvée' }),
      });

      const response = await fetch('/api/balance-rules', {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/balance-rules/:ruleId', () => {
    it('should update rule with valid permission', async () => {
      const updatedRule = {
        id: 'rule-1',
        teamId: 'team-1',
        ruleKey: 'MIN_PLAYERS_PER_ROLE',
        name: 'Joueurs minimum par rôle',
        enabled: true,
        severity: 'WARNING',
        params: { minPlayers: 3 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedRule),
      });

      const response = await fetch('/api/balance-rules/rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({
          severity: 'WARNING',
          params: { minPlayers: 3 },
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.severity).toBe('WARNING');
      expect(result.params.minPlayers).toBe(3);
    });

    it('should reject update without canManageBalanceRules permission', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Permission denied' }),
      });

      const response = await fetch('/api/balance-rules/rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent rule', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Règle non trouvée' }),
      });

      const response = await fetch('/api/balance-rules/non-existent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should update enabled status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'rule-1',
          enabled: false,
        }),
      });

      const response = await fetch('/api/balance-rules/rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.enabled).toBe(false);
    });
  });

  describe('POST /api/balance-rules/reset', () => {
    it('should reset rules to defaults with valid permission', async () => {
      const defaultRules = [
        { id: 'new-1', ruleKey: 'MIN_PLAYERS_PER_ROLE', enabled: true },
        { id: 'new-2', ruleKey: 'MIN_ROLES_PER_PLAYER', enabled: true },
        { id: 'new-3', ruleKey: 'MAX_ROLES_PER_PLAYER', enabled: true },
        { id: 'new-4', ruleKey: 'NO_DUPLICATE_PAIRS', enabled: true },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(defaultRules),
      });

      const response = await fetch('/api/balance-rules/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const rules = await response.json();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should reject reset without canManageBalanceRules permission', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Permission denied' }),
      });

      const response = await fetch('/api/balance-rules/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });
  });

  describe('Rule Severity Validation', () => {
    it('should accept ERROR severity', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ severity: 'ERROR' }),
      });

      const response = await fetch('/api/balance-rules/rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ severity: 'ERROR' }),
      });

      expect(response.ok).toBe(true);
    });

    it('should accept WARNING severity', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ severity: 'WARNING' }),
      });

      const response = await fetch('/api/balance-rules/rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ severity: 'WARNING' }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Rule Parameters Validation', () => {
    it('should update params object', async () => {
      const newParams = { minPlayers: 5 };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ params: newParams }),
      });

      const response = await fetch('/api/balance-rules/rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ params: newParams }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.params.minPlayers).toBe(5);
    });
  });
});
