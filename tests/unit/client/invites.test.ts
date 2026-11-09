// Tests for reading a team invitation as a player pastes it
import { describe, it, expect } from 'vitest';
import { inviteCodeOf } from '@/utils/invites';

describe('inviteCodeOf', () => {
  it('takes the code out of a whole link, or the code alone', () => {
    expect(inviteCodeOf('https://scrim-calendar.com/join/AbC123')).toBe('AbC123');
    expect(inviteCodeOf('  http://localhost:5173/join/XYZ9?x=1 ')).toBe('XYZ9');
    expect(inviteCodeOf(' AbC123 ')).toBe('AbC123');
    expect(inviteCodeOf('   ')).toBe('');
  });
});
