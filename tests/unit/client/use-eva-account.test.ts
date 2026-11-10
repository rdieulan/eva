// Tests for the useEvaAccount composable (profile page and walk-through, the
// eva.gg account): linked, changed for another, never dropped
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEvaAccount } from '@/composables/useEvaAccount';
import { fetchMyEvaAccount, linkMyEvaAccount } from '@/api/players.api';
import { ApiError } from '@/api/error';
import { ERROR } from '@shared/constants';

vi.mock('@/api/players.api', () => ({
  fetchMyEvaAccount: vi.fn(),
  linkMyEvaAccount: vi.fn(),
}));

const SIB = { userId: 202617, username: 'Sib#202617', linkedAt: '2026-10-31T21:00:00.000Z' };

beforeEach(() => {
  vi.mocked(fetchMyEvaAccount).mockReset();
  vi.mocked(linkMyEvaAccount).mockReset();
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

  it('changes the account for another, the one linked kept until the new one is', async () => {
    const other = { userId: 724190, username: 'RONxSib#177352', linkedAt: '2026-11-10T12:00:00.000Z' };
    vi.mocked(fetchMyEvaAccount).mockResolvedValue(SIB);
    vi.mocked(linkMyEvaAccount).mockResolvedValue(other);
    const eva = useEvaAccount();
    await eva.load();

    eva.startChange();
    expect(eva.isChanging.value).toBe(true);
    expect(eva.link.value).toEqual(SIB);
    eva.username.value = 'RONxSib#177352';
    await eva.linkAccount();

    expect(eva.link.value).toEqual(other);
    expect(eva.isChanging.value).toBe(false);
    expect(eva.successMessage.value).toBe('Compte eva.gg changé');
  });

  it('keeps the account linked when the change is called off, or refused', async () => {
    vi.mocked(fetchMyEvaAccount).mockResolvedValue(SIB);
    vi.mocked(linkMyEvaAccount).mockRejectedValue(new ApiError([ERROR.evaAccountAlreadyLinked], ERROR.evaAccountLinkFailed));
    const eva = useEvaAccount();
    await eva.load();

    eva.startChange();
    eva.username.value = 'Taken#000001';
    await eva.linkAccount();
    expect(eva.link.value).toEqual(SIB);
    expect(eva.isChanging.value).toBe(true);
    expect(eva.errors.value).toEqual([ERROR.evaAccountAlreadyLinked]);

    eva.cancelChange();
    expect(eva.isChanging.value).toBe(false);
    expect(eva.username.value).toBe('');
    expect(eva.errors.value).toEqual([]);
    expect(eva.link.value).toEqual(SIB);
  });
});
