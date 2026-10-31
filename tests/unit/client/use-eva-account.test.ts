// Tests for the useEvaAccount composable (profile page, eva.gg section)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEvaAccount } from '@/composables/useEvaAccount';
import { fetchMyEvaAccount, linkMyEvaAccount, unlinkMyEvaAccount } from '@/api/players.api';
import { ApiError } from '@/api/error';
import { ERROR } from '@shared/constants';

vi.mock('@/api/players.api', () => ({
  fetchMyEvaAccount: vi.fn(),
  linkMyEvaAccount: vi.fn(),
  unlinkMyEvaAccount: vi.fn(),
}));

const SIB = { userId: 202617, username: 'Sib#202617', linkedAt: '2026-10-31T21:00:00.000Z' };

beforeEach(() => {
  vi.mocked(fetchMyEvaAccount).mockReset();
  vi.mocked(linkMyEvaAccount).mockReset();
  vi.mocked(unlinkMyEvaAccount).mockReset();
});

describe('useEvaAccount', () => {
  it('loads the linked account and tells when it was linked', async () => {
    vi.mocked(fetchMyEvaAccount).mockResolvedValue(SIB);
    const eva = useEvaAccount();

    await eva.load();

    expect(eva.link.value).toEqual(SIB);
    expect(eva.linkedOn.value).toMatch(/2026/);
    expect(eva.isLoading.value).toBe(false);
  });

  it('refuses to send an empty tag', async () => {
    const eva = useEvaAccount();
    eva.username.value = '   ';

    await eva.linkAccount();

    expect(linkMyEvaAccount).not.toHaveBeenCalled();
    expect(eva.errors.value).toEqual([ERROR.evaUsernameRequired]);
  });

  it('links the trimmed tag, keeps the answer and clears the field', async () => {
    vi.mocked(linkMyEvaAccount).mockResolvedValue(SIB);
    const eva = useEvaAccount();
    eva.username.value = ' sib#202617 ';

    await eva.linkAccount();

    expect(linkMyEvaAccount).toHaveBeenCalledWith('sib#202617');
    expect(eva.link.value).toEqual(SIB);
    expect(eva.username.value).toBe('');
    expect(eva.successMessage.value).toBeTruthy();
    expect(eva.errors.value).toEqual([]);
  });

  it('shows the server refusal as is', async () => {
    vi.mocked(linkMyEvaAccount).mockRejectedValue(new ApiError([ERROR.evaPlayerNotFound], ERROR.evaAccountLinkFailed));
    const eva = useEvaAccount();
    eva.username.value = 'Nobody#000000';

    await eva.linkAccount();

    expect(eva.link.value).toBeNull();
    expect(eva.username.value).toBe('Nobody#000000');
    expect(eva.errors.value).toEqual([ERROR.evaPlayerNotFound]);
  });

  it('forgets the account once unlinked', async () => {
    vi.mocked(fetchMyEvaAccount).mockResolvedValue(SIB);
    vi.mocked(unlinkMyEvaAccount).mockResolvedValue();
    const eva = useEvaAccount();
    await eva.load();

    await eva.unlinkAccount();

    expect(unlinkMyEvaAccount).toHaveBeenCalled();
    expect(eva.link.value).toBeNull();
    expect(eva.linkedOn.value).toBeNull();
  });

  it('keeps the account when unlinking fails', async () => {
    vi.mocked(fetchMyEvaAccount).mockResolvedValue(SIB);
    vi.mocked(unlinkMyEvaAccount).mockRejectedValue(new Error('boom'));
    const eva = useEvaAccount();
    await eva.load();

    await eva.unlinkAccount();

    expect(eva.link.value).toEqual(SIB);
    expect(eva.errors.value).toEqual(['boom']);
  });
});
