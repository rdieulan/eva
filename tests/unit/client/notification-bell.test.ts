// Tests for the bell of the top bar: the unread count kept up to date, the list, and where a notification leads
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import NotificationBell from '@/components/common/layout/NotificationBell.vue';
import { fetchNotifications, fetchUnreadNotificationCount, markNotificationsRead } from '@/api';
import { ApiError } from '@/api/error';
import { NOTIFICATION_POLL_INTERVAL_MS } from '@shared/constants';
import type { InboxNotification } from '@shared/types';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/api', () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

const FACTS = { date: '2026-11-25', startTime: '19:20', endTime: '20:40', venueId: 'venue-nimes', venueName: 'Nîmes', arenaNumber: null };

const RECEIVED: InboxNotification = {
  id: 'n-2', createdAt: new Date().toISOString(), isRead: false,
  kind: 'SCRIM_PROPOSAL_RECEIVED', data: { ...FACTS, searchId: 'search-1', teamName: 'Les Rivaux', message: null },
};
const CANCELLED: InboxNotification = {
  id: 'n-1', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), isRead: true,
  kind: 'SCRIM_MATCH_CANCELLED', data: { ...FACTS, opponentName: 'Les Rivaux', byOpponent: true },
};

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

let wrapper: ReturnType<typeof mount> | null = null;

async function mountBell() {
  wrapper = mount(NotificationBell, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.mocked(fetchUnreadNotificationCount).mockReset().mockResolvedValue(1);
  vi.mocked(fetchNotifications).mockReset().mockResolvedValue({ notifications: [RECEIVED, CANCELLED], unreadCount: 1 });
  vi.mocked(markNotificationsRead).mockReset().mockResolvedValue();
  push.mockReset();
  setVisibility('visible');
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.useRealTimers();
});

describe('NotificationBell', () => {
  it('shows how many notifications are unread, nine at most before it stops counting', async () => {
    const bell = await mountBell();
    expect(bell.find('.badge').text()).toBe('1');
    expect(bell.find('button.btn-bell').attributes('aria-label')).toBe('Notifications, 1 non lue');
    bell.unmount();

    vi.mocked(fetchUnreadNotificationCount).mockResolvedValue(12);
    const busy = await mountBell();
    expect(busy.find('.badge').text()).toBe('9+');
    busy.unmount();

    vi.mocked(fetchUnreadNotificationCount).mockResolvedValue(0);
    const quiet = await mountBell();
    expect(quiet.find('.badge').exists()).toBe(false);
  });

  it('opens on the latest notifications in words, the new ones marked, then counts them as seen', async () => {
    const bell = await mountBell();

    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();

    const items = bell.findAll('button.item');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('Match proposé');
    expect(items[0]!.text()).toContain('Les Rivaux · mer. 25/11 · 19:20 – 20:40 · Nîmes');
    expect(items[0]!.text()).toContain('à l\'instant');
    expect(items[0]!.element.parentElement!.classList).toContain('unread');
    expect(items[1]!.text()).toContain('Match annulé');
    expect(items[1]!.text()).toContain('il y a 2 h');
    expect(items[1]!.element.parentElement!.classList).not.toContain('unread');
    expect(markNotificationsRead).toHaveBeenCalledWith(['n-2']);
    expect(bell.find('.badge').exists()).toBe(false);
  });

  it('shows each notification with the symbol and colour of its subject, a match called off in red', async () => {
    const bell = await mountBell();
    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();

    const [received, cancelled] = bell.findAllComponents({ name: 'SubjectIcon' });
    expect(received!.props()).toMatchObject({ subject: 'matchmaking', tone: 'subject' });
    expect(cancelled!.props()).toMatchObject({ subject: 'match', tone: 'refused' });
    expect(received!.classes()).toContain('subject-icon--matchmaking');
    expect(cancelled!.classes()).toContain('subject-icon--refused');
  });

  it('leads to what a notification is about, and closes', async () => {
    const bell = await mountBell();
    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();

    await bell.findAll('button.item')[0]!.trigger('click');

    expect(push).toHaveBeenCalledWith({ path: '/calendar', query: { date: '2026-11-25', mode: 'matchmaking', search: 'search-1' } });
    expect(bell.find('.panel').exists()).toBe(false);
  });

  it('offers the step to take outside the app under its notification, in a tab of its own, and leads to the team page', async () => {
    const reminder: InboxNotification = {
      id: 'n-3', createdAt: new Date().toISOString(), isRead: false,
      kind: 'LEAGUE_REGISTRATION_OPEN',
      data: { tournamentId: '2570489683180220415', tournamentName: 'NEMAUSUS LEAGUE - DÉCEMBRE', closesAt: '2026-12-30T23:00:00.000Z' },
    };
    vi.mocked(fetchNotifications).mockResolvedValue({ notifications: [reminder, CANCELLED], unreadCount: 1 });
    const bell = await mountBell();
    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();

    const links = bell.findAll('a.item-elsewhere');
    expect(links).toHaveLength(1);
    expect(links[0]!.text()).toBe('S\'inscrire sur competitive.eva.gg ↗');
    expect(links[0]!.attributes()).toMatchObject({
      href: 'https://competitive.eva.gg/fr/tournaments/2570489683180220415/registration',
      target: '_blank',
      rel: 'noopener noreferrer',
    });

    await bell.findAll('button.item')[0]!.trigger('click');
    expect(push).toHaveBeenCalledWith({ path: '/team' });
  });

  it('closes on a click elsewhere and on Escape', async () => {
    const bell = await mountBell();
    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();

    document.body.click();
    await flushPromises();
    expect(bell.find('.panel').exists()).toBe(false);

    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(bell.find('.panel').exists()).toBe(false);
  });

  it('says when there is nothing, and why when the bell cannot be read', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ notifications: [], unreadCount: 0 });
    const bell = await mountBell();
    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();
    expect(bell.text()).toContain('Aucune notification pour le moment.');
    await bell.find('button.btn-bell').trigger('click');

    vi.mocked(fetchNotifications).mockRejectedValue(new ApiError(['Erreur lors du chargement des notifications'], 'fallback'));
    await bell.find('button.btn-bell').trigger('click');
    await flushPromises();
    expect(bell.text()).toContain('Erreur lors du chargement des notifications');
    expect(bell.text()).not.toContain('Aucune notification');
  });

  it('asks the count again every minute while the tab is shown, never while it is hidden, and at once when it shows again', async () => {
    vi.useFakeTimers();
    await mountBell();
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_INTERVAL_MS);
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(2);

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(3 * NOTIFICATION_POLL_INTERVAL_MS);
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(2);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(3);
  });
});
