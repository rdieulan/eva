// Tests for EventViewerModal: what it tells about a match on eva.gg
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';
import { fetchVenueSlots } from '@/api/teams.api';
import type { CalendarEvent, VenueSlot } from '@shared/types';

vi.mock('@/api/teams.api', () => ({
  fetchVenueSlots: vi.fn(),
}));

// Far enough ahead that the match never reads as past
const FUTURE_DATE = '2030-11-03';

const SLOT_20H: VenueSlot = {
  slotId: 'slot-20:00',
  startTime: '20:00',
  endTime: '20:40',
  convocationTime: '19:50',
  arenaNumber: 1,
  takenSeats: 7,
  totalSeats: 10,
  gameId: 1,
  isCompetitiveAvailable: true,
  tokenType: null,
  passQuotaLeft: null,
};
const SLOT_20H40: VenueSlot = { ...SLOT_20H, slotId: 'slot-20:40', startTime: '20:40', endTime: '21:20' };

function match(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    date: FUTURE_DATE,
    startTime: '20:00',
    endTime: '21:20',
    type: 'MATCH',
    title: 'Scrim vs TeamX',
    venue: { id: 'venue-1', name: 'Nîmes', evaLocationId: 51, discord: null },
    arenaNumber: 1,
    evaSlotIds: ['slot-20:00', 'slot-20:40'],
    createdById: 'player-1',
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function mountViewer(event: CalendarEvent = match()) {
  return mount(EventViewerModal, {
    props: { events: [event] },
    global: { stubs: { Teleport: true } },
  });
}

beforeEach(() => {
  vi.mocked(fetchVenueSlots).mockReset();
  vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H, SLOT_20H40]);
});

describe('EventViewerModal - booking on eva.gg', () => {
  it('sends the player to the booking calendar of the venue on the day of the match', async () => {
    const wrapper = mountViewer();
    await flushPromises();

    const link = wrapper.find('a.btn-booking');
    const url = new URL(link.attributes('href')!);
    expect(url.searchParams.get('locationId')).toBe('51');
    expect(url.searchParams.get('currentDate')).toBe(FUTURE_DATE);
    expect(link.attributes('target')).toBe('_blank');
  });

  it('offers no booking link for a venue eva.gg does not run', async () => {
    const wrapper = mountViewer(match({
      venue: { id: 'venue-2', name: 'Garage', evaLocationId: null, discord: null },
      evaSlotIds: [],
    }));
    await flushPromises();

    expect(wrapper.find('a.btn-booking').exists()).toBe(false);
  });

  it('links to the Discord of the venue when it has one', async () => {
    const wrapper = mountViewer(match({
      venue: { id: 'venue-1', name: 'Nîmes', evaLocationId: 51, discord: 'https://discord.gg/evanimes' },
    }));
    await flushPromises();

    const link = wrapper.find('a.detail-link');
    expect(link.text()).toBe('Discord');
    expect(link.attributes('href')).toBe('https://discord.gg/evanimes');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('lays the match out on the sheet of an event: its day, its hours with its slots, its venue, then the booking', async () => {
    const wrapper = mountViewer(match({ description: 'Convocation 19:50' }));
    await flushPromises();

    expect(wrapper.find('.event-title').text()).toBe('Scrim vs TeamX');
    const rows = wrapper.findAll('.detail-row').map(row => row.find('.detail-label').text());
    expect(rows).toEqual(['📅 Date', '🕐 Horaire', '👥 Sur eva.gg', '📍 Salle']);
    expect(wrapper.findAll('.detail-row')[1]!.find('.detail-value').text()).toBe('20:00 - 21:20 2 créneaux');
    const sheet = wrapper.find('.event-sheet').element;
    const booking = wrapper.find('a.btn-booking').element;
    const description = wrapper.find('.event-description').element;
    expect(sheet.contains(booking)).toBe(true);
    expect(booking.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no Discord link when the venue has none', async () => {
    const wrapper = mountViewer();
    await flushPromises();

    expect(wrapper.find('a.detail-link').exists()).toBe(false);
  });

  it('offers no booking link on a past match', async () => {
    const wrapper = mountViewer(match({ date: '2020-01-01' }));
    await flushPromises();

    expect(wrapper.find('a.btn-booking').exists()).toBe(false);
  });

  it('warns when the slots of the match are short of a full 8, whatever capacity eva.gg shows', async () => {
    const wrapper = mountViewer();
    await flushPromises();

    const line = wrapper.find('.booked-line');
    expect(line.text()).toBe('7/8 joueurs · il en manque 1');
    expect(line.classes()).toContain('headcount-missing');
    expect(fetchVenueSlots).toHaveBeenCalledWith('venue-1', FUTURE_DATE);
  });

  it('says the match is full at exactly 8', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([
      { ...SLOT_20H, takenSeats: 8 },
      { ...SLOT_20H40, takenSeats: 8 },
    ]);
    const wrapper = mountViewer();
    await flushPromises();

    const line = wrapper.find('.booked-line');
    expect(line.text()).toBe('8/8 joueurs');
    expect(line.classes()).toContain('headcount-full');
  });

  it('flags extra players who are not expected on the slot', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([
      { ...SLOT_20H, takenSeats: 10 },
      { ...SLOT_20H40, takenSeats: 10 },
    ]);
    const wrapper = mountViewer();
    await flushPromises();

    const line = wrapper.find('.booked-line');
    expect(line.text()).toBe('10/8 joueurs · 2 de trop');
    expect(line.classes()).toContain('headcount-over');
  });

  it('breaks the count down when the slots of the match do not hold the same players', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H, { ...SLOT_20H40, takenSeats: 3 }]);
    const wrapper = mountViewer();
    await flushPromises();

    const lines = wrapper.findAll('.booked-line').map(l => l.text());
    expect(lines).toEqual(['20:00 : 7/8 joueurs · il en manque 1', '20:40 : 3/8 joueurs · il en manque 5']);
  });

  it('asks eva.gg nothing for a match placed on no slot', async () => {
    const wrapper = mountViewer(match({ evaSlotIds: [] }));
    await flushPromises();

    expect(fetchVenueSlots).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('inscrits');
  });

  it('says nothing about bookings when eva.gg cannot be read', async () => {
    vi.mocked(fetchVenueSlots).mockRejectedValue(new Error('502'));
    const wrapper = mountViewer();
    await flushPromises();

    expect(wrapper.text()).not.toContain('inscrits');
    expect(wrapper.find('a.btn-booking').exists()).toBe(true);
  });
});
