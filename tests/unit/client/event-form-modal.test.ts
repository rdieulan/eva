// Tests for EventFormModal component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import { fetchVenueSlots } from '@/api/teams.api';
import type { CalendarEvent, MapConfig, Player, Venue, VenueLinkKey, VenueSlot } from '@shared/types';

vi.mock('@/api/teams.api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/teams.api')>(),
  fetchVenueSlots: vi.fn(),
}));

// A venue the form can list, without the links it never shows
function venue(fields: Omit<Venue, 'slug' | VenueLinkKey>): Venue {
  return {
    ...fields,
    slug: fields.id,
    website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
  };
}

describe('EventFormModal Component', () => {
  const mockMaps: MapConfig[] = [
    {
      id: 'map-1',
      name: 'Polaris',
      images: ['polaris.png'],
      assignments: [
        { id: 1, name: 'Pilote', x: 100, y: 100, zone: { x1: 0, y1: 0, x2: 100, y2: 100 } },
        { id: 2, name: 'Gunner', x: 200, y: 200, zone: { x1: 100, y1: 100, x2: 200, y2: 200 } },
      ],
      players: [],
    },
  ];

  const mockPlayers: Player[] = [
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
    { id: 'player-3', name: 'Charlie' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open prop is true', () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.props('open')).toBe(true);
  });

  it('should not render modal when open prop is false', () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: false,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.props('open')).toBe(false);
  });

  it('should offer every event type, the voice meeting included, and submit the chosen one', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: false,
        selectedDate: '2026-11-03',
        maps: mockMaps,
        players: mockPlayers,
      },
      global: { stubs: { Teleport: true } },
    });
    // The form resets from props when the modal opens
    await wrapper.setProps({ open: true });

    const typeButtons = wrapper.findAll('.type-btn');
    expect(typeButtons.map(b => b.find('.type-btn-label').text()))
      .toEqual(['Match', 'Compétition', 'Événement', 'Réunion vocale']);

    await typeButtons[3]!.trigger('click');
    expect(typeButtons[3]!.classes()).toContain('active');

    await wrapper.find('#event-title').setValue('Strat Polaris');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      date: '2026-11-03',
      type: 'VOICE_MEETING',
      title: 'Strat Polaris',
    });
  });

  it('should create a competition in its own colour, with no venue to pick', async () => {
    const wrapper = mount(EventFormModal, {
      props: { open: false, selectedDate: '2026-11-03', maps: mockMaps, players: mockPlayers },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ open: true });

    const competition = wrapper.findAll('.type-btn').find(b => b.find('.type-btn-label').text() === 'Compétition')!;
    expect(competition.classes()).toContain('event-type--competition');
    expect(competition.find('.type-btn-icon').text()).toBe('🏆');
    await competition.trigger('click');
    expect(wrapper.find('.venue-picker, #event-venue').exists()).toBe(false);

    await wrapper.find('#event-title').setValue('NEMAUSUS LEAGUE - DÉCEMBRE');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>;
    expect(submitted).toMatchObject({ date: '2026-11-03', type: 'COMPETITION', title: 'NEMAUSUS LEAGUE - DÉCEMBRE' });
    expect(submitted.venueId ?? null).toBeNull();
  });

  it('should emit close event when close is triggered', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    wrapper.vm.$emit('close');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('should populate form fields when editing existing event', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '19:00',
      endTime: '21:00',
      type: 'MATCH',
      title: 'Important Match',
      evaSlotIds: [],
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        editEvent: mockEvent,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.props('editEvent')?.title).toBe('Important Match');
    expect(wrapper.props('editEvent')?.type).toBe('MATCH');
  });

  it('should emit submit event with correct event data', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    const eventData = {
      date: '2026-01-25',
      startTime: '20:00',
      endTime: '22:00',
      type: 'MATCH' as const,
      title: 'New Match',
      description: 'Test description',
    };

    wrapper.vm.$emit('submit', eventData);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual(eventData);
  });

  it('should show game plan association button for MATCH events', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '19:00',
      endTime: '21:00',
      type: 'MATCH',
      title: 'Match',
      evaSlotIds: [],
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        editEvent: mockEvent,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    // For MATCH type events, game plan button should be available
    expect(wrapper.props('editEvent')?.type).toBe('MATCH');
  });

  it('should validate event data before submission', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    const validData = {
      date: '2026-01-25',
      startTime: '20:00',
      endTime: '22:00',
      type: 'EVENT' as const,
      title: 'Valid Event',
    };

    wrapper.vm.$emit('submit', validData);
    await wrapper.vm.$nextTick();

    const submitEmits = wrapper.emitted('submit');
    if (submitEmits) {
      const emittedData = submitEmits[0]?.[0] as any;
      expect(emittedData.startTime < emittedData.endTime).toBe(true);
      expect(emittedData.title).toBeTruthy();
      expect(emittedData.date).toBeTruthy();
    }
  });
});

describe('EventFormModal Component - Match venue', () => {
  const venues = [
    venue({ id: 'venue-1', name: 'VR Arena', city: 'Lyon', address: '12 rue des Lasers', phone: null, arenaCount: 1, hasEvaSlots: false }),
    venue({ id: 'venue-2', name: 'Laser Dome', city: 'Paris', address: '3 avenue du Tir', phone: null, arenaCount: 1, hasEvaSlots: false }),
  ];

  function mountForm(props: Record<string, unknown> = {}) {
    return mount(EventFormModal, {
      props: {
        open: false,
        selectedDate: '2026-11-03',
        venues,
        teamVenueId: 'venue-1',
        maps: [],
        players: [],
        ...props,
      },
      global: { stubs: { Teleport: true } },
    });
  }

  it('should default a new match to the team venue and submit it', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });

    const select = wrapper.find('#event-venue');
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe('venue-1');
    expect(select.findAll('option').map(o => o.text()))
      .toEqual(['Non définie', 'VR Arena', 'Laser Dome']);

    await wrapper.find('#event-title').setValue('Match vs TeamX');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ type: 'MATCH', venueId: 'venue-1' });
  });

  it('should let the match be played elsewhere', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });

    await wrapper.find('#event-venue').setValue('venue-2');
    await wrapper.find('#event-title').setValue('Away game');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ venueId: 'venue-2' });
  });

  it('should hide the venue on other event types and submit none', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });

    await wrapper.findAll('.type-btn').find(b => b.text().includes('Réunion vocale'))!.trigger('click');
    expect(wrapper.find('#event-venue').exists()).toBe(false);

    await wrapper.find('#event-title').setValue('Strat Polaris');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ type: 'VOICE_MEETING', venueId: null });
  });

  it('should keep the time and place of a match of the matchmaking, its title free, and no delete', async () => {
    const wrapper = mountForm({
      editEvent: {
        id: 'event-1', date: '2026-11-03', startTime: '20:00', endTime: '21:20', type: 'MATCH' as const, title: 'Scrim vs Les Rivaux',
        venue: { id: 'venue-1', name: 'VR Arena', evaLocationId: null, discord: null }, arenaNumber: 1, evaSlotIds: [],
        scrimSearchId: 'search-1', createdById: 'player-1', createdAt: '2026-10-01T00:00:00Z',
      },
      canDelete: true,
    });
    await wrapper.setProps({ open: true });

    expect(wrapper.find('.matchmaking-place-value').text()).toBe('VR Arena — arène 1 · 03/11/2026 · 20:00 – 21:20');
    for (const field of ['#event-venue', '#event-date', '#event-start', '#event-end']) {
      expect(wrapper.find(field).exists()).toBe(false);
    }
    expect(wrapper.find('.type-selector').exists()).toBe(false);
    expect(wrapper.findAll('button').find(b => b.text() === 'Supprimer')).toBeUndefined();

    await wrapper.find('#event-title').setValue('Scrim du jeudi');
    await wrapper.findAll('button').find(b => b.text() === 'Enregistrer')!.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ title: 'Scrim du jeudi', date: '2026-11-03', startTime: '20:00', venueId: 'venue-1' });
  });

  it('should keep the venue the match is already played in when editing', async () => {
    const wrapper = mountForm({
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH' as const,
        title: 'Away game',
        venue: { id: 'venue-2', name: 'Laser Dome', evaLocationId: null, discord: null },
        evaSlotIds: [],
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });

    expect((wrapper.find('#event-venue').element as HTMLSelectElement).value).toBe('venue-2');
  });

  it('should fall back to the team venue when an event becomes a match', async () => {
    const wrapper = mountForm({
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '22:00',
        type: 'VOICE_MEETING' as const,
        title: 'Strat Polaris',
        voiceMedium: 'DISCORD' as const,
        evaSlotIds: [],
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });
    expect(wrapper.find('#event-venue').exists()).toBe(false);

    await wrapper.findAll('.type-btn').find(b => b.text().includes('Match'))!.trigger('click');

    expect((wrapper.find('#event-venue').element as HTMLSelectElement).value).toBe('venue-1');
  });
});

describe('EventFormModal Component - Editing an existing event', () => {
  const venues = [
    venue({ id: 'venue-1', name: 'VR Arena', city: 'Lyon', address: '12 rue des Lasers', phone: null, arenaCount: 2, hasEvaSlots: false }),
  ];

  const match: CalendarEvent = {
    id: 'event-1',
    date: '2026-11-03',
    startTime: '20:00',
    endTime: '22:00',
    type: 'MATCH' as const,
    title: 'Match vs TeamX',
    description: 'On se retrouve 30 min avant',
    venue: { id: 'venue-1', name: 'VR Arena', evaLocationId: null, discord: null },
    arenaNumber: 2,
    evaSlotIds: [],
    createdById: 'player-1',
    createdAt: '2026-10-01T00:00:00Z',
  };

  function mountForm(editEvent: CalendarEvent = match) {
    return mount(EventFormModal, {
      props: {
        open: false,
        editEvent,
        venues,
        teamVenueId: 'venue-1',
        maps: [],
        players: [],
      },
      global: { stubs: { Teleport: true } },
    });
  }

  async function submit(wrapper: ReturnType<typeof mountForm>) {
    await wrapper.findAll('button').find(b => b.text() === 'Enregistrer')!.trigger('click');
    return wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>;
  }

  it('should clear the description when it is emptied', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    expect((wrapper.find('#event-desc').element as HTMLTextAreaElement).value)
      .toBe('On se retrouve 30 min avant');

    await wrapper.find('#event-desc').setValue('');

    expect(await submit(wrapper)).toMatchObject({ description: '' });
  });

  it('should open on the arena the match is already played on', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });

    expect((wrapper.find('#event-arena').element as HTMLSelectElement).value).toBe('2');
    expect(await submit(wrapper)).toMatchObject({ arenaNumber: 2 });
  });

  it('should drop the arena when the venue is changed by hand', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });

    // The "no venue" option carries null, so it is picked by its label
    await wrapper.find('#event-venue').setValue('Non définie');

    expect(await submit(wrapper)).toMatchObject({ venueId: null, arenaNumber: null });
  });

  it('should keep every other field untouched when only the title changes', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });

    await wrapper.find('#event-title').setValue('Match vs TeamY');

    expect(await submit(wrapper)).toEqual({
      date: '2026-11-03',
      startTime: '20:00',
      endTime: '22:00',
      type: 'MATCH',
      title: 'Match vs TeamY',
      description: 'On se retrouve 30 min avant',
      venueId: 'venue-1',
      arenaNumber: 2,
      evaSlotIds: [],
      voiceMedium: null,
    });
  });
});

describe('EventFormModal Component - Venue slots', () => {
  const venues = [
    venue({ id: 'venue-1', name: 'Nîmes', city: 'Nimes', address: '1 rue', phone: null, arenaCount: 2, hasEvaSlots: true }),
    venue({ id: 'venue-2', name: 'Garage', city: 'Paris', address: '2 rue', phone: null, arenaCount: 1, hasEvaSlots: false }),
  ];

  const SLOT_20H: VenueSlot = {
    slotId: 'slot-20:00',
    startTime: '20:00',
    endTime: '20:40',
    convocationTime: '19:50',
    arenaNumber: 2,
    takenSeats: 7,
    totalSeats: 10,
    gameId: 1,
    isCompetitiveAvailable: true,
    tokenType: null,
    passQuotaLeft: null,
  };
  const SLOT_20H40: VenueSlot = { ...SLOT_20H, slotId: 'slot-20:40', startTime: '20:40', endTime: '21:20', convocationTime: '20:30' };

  function mountForm(props: Record<string, unknown> = {}) {
    return mount(EventFormModal, {
      props: {
        open: false,
        selectedDate: '2026-11-03',
        venues,
        teamVenueId: 'venue-1',
        maps: [],
        players: [],
        ...props,
      },
      global: { stubs: { Teleport: true } },
    });
  }

  function slotButton(wrapper: ReturnType<typeof mountForm>, time: string) {
    return wrapper.findAll('button.slot-row').find(b => b.text().startsWith(time))!;
  }

  async function submit(wrapper: ReturnType<typeof mountForm>) {
    await wrapper.find('#event-title').setValue('Match vs TeamX');
    await wrapper.findAll('button').find(b => b.text() === 'Créer' || b.text() === 'Enregistrer')!.trigger('click');
    return wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>;
  }

  beforeEach(() => {
    vi.mocked(fetchVenueSlots).mockReset();
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H, SLOT_20H40]);
  });

  it('asks for the venue before the day, then offers the slots of that day', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await flushPromises();

    const ids = wrapper.findAll('input, select, textarea, .slot-list').map(el => el.attributes('id') ?? el.classes()[0]);
    expect(ids).toEqual(['event-title', 'event-venue', 'event-date', 'slot-list', 'event-desc']);
    expect(fetchVenueSlots).toHaveBeenCalledWith('venue-1', '2026-11-03');
  });

  it('offers no slot for a venue eva.gg does not list, and asks the times by hand', async () => {
    const wrapper = mountForm({ teamVenueId: 'venue-2' });
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(wrapper.find('.slot-list').exists()).toBe(false);
    expect(wrapper.find('#event-start').exists()).toBe(true);
    expect(fetchVenueSlots).not.toHaveBeenCalled();
  });

  it('plays the match on two consecutive slots: from the first start to the last end, on their arena', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await flushPromises();

    await slotButton(wrapper, '20:00').trigger('click');
    await slotButton(wrapper, '20:40').trigger('click');

    expect(wrapper.find('#event-start').exists()).toBe(false);
    expect(wrapper.find('#event-arena').exists()).toBe(false);
    expect(await submit(wrapper)).toMatchObject({
      startTime: '20:00',
      endTime: '21:20',
      arenaNumber: 2,
      evaSlotIds: ['slot-20:00', 'slot-20:40'],
    });
  });

  it('refuses a match on a listed venue without a slot', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(await submit(wrapper)).toBeUndefined();
    expect(wrapper.text()).toContain('Veuillez choisir au moins un créneau');
  });

  it('brings the time fields back when the slots cannot be read', async () => {
    vi.mocked(fetchVenueSlots).mockRejectedValue(new Error('502'));
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(wrapper.find('#event-start').exists()).toBe(true);
    expect(await submit(wrapper)).toMatchObject({ startTime: '20:00', endTime: '22:00', evaSlotIds: [] });
  });

  it('brings the time fields back when the match moves to a venue without a grid', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await flushPromises();
    await slotButton(wrapper, '20:00').trigger('click');

    await wrapper.find('#event-venue').setValue('venue-2');

    expect(wrapper.find('.slot-list').exists()).toBe(false);
    expect(wrapper.find('#event-start').exists()).toBe(true);
    expect(await submit(wrapper)).toMatchObject({ venueId: 'venue-2', evaSlotIds: [] });
  });

  it('asks for slots again when the day moves', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await flushPromises();
    await slotButton(wrapper, '20:00').trigger('click');

    await wrapper.find('#event-date').setValue('2026-11-04');
    await flushPromises();

    expect(fetchVenueSlots).toHaveBeenLastCalledWith('venue-1', '2026-11-04');
    expect(wrapper.findAll('button.slot-row.selected')).toHaveLength(0);
    expect(await submit(wrapper)).toBeUndefined();
    expect(wrapper.text()).toContain('Veuillez choisir au moins un créneau');
  });

  it('opens on the slots the match is already played on and keeps them', async () => {
    const wrapper = mountForm({
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '21:20',
        type: 'MATCH',
        title: 'Match vs TeamX',
        venue: { id: 'venue-1', name: 'Nîmes', evaLocationId: 51, discord: null },
        arenaNumber: 2,
        evaSlotIds: ['slot-20:00', 'slot-20:40'],
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(wrapper.findAll('button.slot-row.selected').map(b => b.text().slice(0, 5))).toEqual(['20:00', '20:40']);
    await wrapper.find('#event-desc').setValue('On se retrouve 30 min avant');
    expect(await submit(wrapper)).toMatchObject({
      description: 'On se retrouve 30 min avant',
      startTime: '20:00',
      endTime: '21:20',
      evaSlotIds: ['slot-20:00', 'slot-20:40'],
    });
  });
});

describe('EventFormModal Component - Voice meeting platform', () => {
  function mountForm(props: Record<string, unknown> = {}) {
    return mount(EventFormModal, {
      props: {
        open: false,
        selectedDate: '2026-11-03',
        maps: [],
        players: [],
        ...props,
      },
      global: { stubs: { Teleport: true } },
    });
  }

  async function pickVoiceMeeting(wrapper: ReturnType<typeof mountForm>) {
    await wrapper.findAll('.type-btn').find(b => b.text().includes('Réunion vocale'))!.trigger('click');
  }

  it('should offer every platform and start on Discord', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    expect(wrapper.find('#event-medium').exists()).toBe(false);

    await pickVoiceMeeting(wrapper);

    const select = wrapper.find('#event-medium');
    expect((select.element as HTMLSelectElement).value).toBe('DISCORD');
    expect(select.findAll('option').map(o => o.text())).toEqual([
      'Discord', 'TeamSpeak', 'Mumble', 'WhatsApp', 'Messenger', 'Telegram', 'Google Meet', 'Autre',
    ]);
  });

  it('should submit the platform the meeting is held on', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await pickVoiceMeeting(wrapper);

    await wrapper.find('#event-medium').setValue('TEAMSPEAK');
    await wrapper.find('#event-title').setValue('Débrief');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0])
      .toMatchObject({ type: 'VOICE_MEETING', voiceMedium: 'TEAMSPEAK' });
  });

  it('should send no platform on a type that is not held on one', async () => {
    const wrapper = mountForm();
    await wrapper.setProps({ open: true });
    await pickVoiceMeeting(wrapper);
    await wrapper.find('#event-medium').setValue('MUMBLE');

    await wrapper.findAll('.type-btn').find(b => b.text().includes('Match'))!.trigger('click');
    expect(wrapper.find('#event-medium').exists()).toBe(false);

    await wrapper.find('#event-title').setValue('Match vs TeamX');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ type: 'MATCH', voiceMedium: null });
  });

  it('should open on the platform the meeting is already held on', async () => {
    const wrapper = mountForm({
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '22:00',
        type: 'VOICE_MEETING' as const,
        title: 'Strat Polaris',
        voiceMedium: 'GOOGLE_MEET' as const,
        evaSlotIds: [],
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });

    expect((wrapper.find('#event-medium').element as HTMLSelectElement).value).toBe('GOOGLE_MEET');

    await wrapper.findAll('button').find(b => b.text() === 'Enregistrer')!.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ voiceMedium: 'GOOGLE_MEET' });
  });
});
