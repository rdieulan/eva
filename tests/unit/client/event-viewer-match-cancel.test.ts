// Tests for EventViewerModal: calling off a match the matchmaking made
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';
import { cancelScrimMatch } from '@/api';
import { ApiError } from '@/api/error';
import type { CalendarEvent } from '@shared/types';

vi.mock('@/api', () => ({
  cancelScrimMatch: vi.fn(),
}));

vi.mock('@/api/teams.api', () => ({
  fetchVenueSlots: vi.fn(async () => []),
}));

function match(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1', date: '2030-11-03', startTime: '20:00', endTime: '21:20', type: 'MATCH', title: 'Scrim vs Les Rivaux',
    venue: { id: 'venue-1', name: 'Nîmes', evaLocationId: 51, discord: null }, arenaNumber: 1, evaSlotIds: ['s-1', 's-2'],
    scrimSearchId: 'search-1', createdById: 'player-1', createdAt: '', ...overrides,
  };
}

function mountViewer(event: CalendarEvent, props: Record<string, unknown> = {}) {
  return mount(EventViewerModal, {
    props: { events: [event], canEdit: true, canCancelMatch: true, ...props },
    global: { stubs: { Teleport: true } },
  });
}

function button(wrapper: ReturnType<typeof mountViewer>, text: string) {
  return wrapper.findAll('button').find(candidate => candidate.text() === text);
}

beforeEach(() => {
  vi.mocked(cancelScrimMatch).mockReset();
});

describe('EventViewerModal - a match of the matchmaking', () => {
  it('calls it off after confirmation, for both calendars', async () => {
    vi.mocked(cancelScrimMatch).mockResolvedValue();
    const wrapper = mountViewer(match());
    await flushPromises();

    await button(wrapper, 'Annuler le match')!.trigger('click');
    expect(wrapper.text()).toContain('Le match sera retiré de votre calendrier et de celui de l\'autre équipe');
    const confirm = wrapper.findAll('button').filter(candidate => candidate.text() === 'Annuler le match').at(-1)!;
    await confirm.trigger('click');
    await flushPromises();

    expect(cancelScrimMatch).toHaveBeenCalledWith('event-1');
    expect(wrapper.emitted('match-cancelled')).toHaveLength(1);
  });

  it('says why when it cannot', async () => {
    vi.mocked(cancelScrimMatch).mockRejectedValue(new ApiError(['Match du matchmaking introuvable'], 'fallback'));
    const wrapper = mountViewer(match());
    await flushPromises();

    await button(wrapper, 'Annuler le match')!.trigger('click');
    await wrapper.findAll('button').filter(candidate => candidate.text() === 'Annuler le match').at(-1)!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Match du matchmaking introuvable');
    expect(wrapper.emitted('match-cancelled')).toBeFalsy();
  });

  it('offers it to none but a match of the matchmaking, to come, to a reader who may answer matches', async () => {
    expect(button(mountViewer(match({ scrimSearchId: undefined })), 'Annuler le match')).toBeUndefined();
    expect(button(mountViewer(match({ date: '2020-01-01' })), 'Annuler le match')).toBeUndefined();
    expect(button(mountViewer(match(), { canCancelMatch: false }), 'Annuler le match')).toBeUndefined();
  });
});
