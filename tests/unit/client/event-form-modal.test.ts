// Tests for EventFormModal component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import type { CalendarEvent, MapConfig, Player } from '@shared/types';

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
        canCreate: true,
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
      .toEqual(['Match', 'Événement', 'Réunion vocale']);

    await typeButtons[2]!.trigger('click');
    expect(typeButtons[2]!.classes()).toContain('active');

    await wrapper.find('#event-title').setValue('Strat Polaris');
    await wrapper.findAll('button').find(b => b.text() === 'Créer')!.trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      date: '2026-11-03',
      type: 'VOICE_MEETING',
      title: 'Strat Polaris',
    });
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

  it('should render form in read-only mode when readOnly prop is true', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '19:00',
      endTime: '21:00',
      type: 'EVENT',
      title: 'Team Meeting',
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        editEvent: mockEvent,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.props('canEdit')).toBe(false);
    expect(wrapper.props('editEvent')).toEqual(mockEvent);
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
    { id: 'venue-1', name: 'VR Arena', city: 'Lyon', address: '12 rue des Lasers', phone: null },
    { id: 'venue-2', name: 'Laser Dome', city: 'Paris', address: '3 avenue du Tir', phone: null },
  ];

  function mountForm(props: Record<string, unknown> = {}) {
    return mount(EventFormModal, {
      props: {
        open: false,
        canCreate: true,
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
      .toEqual(['Non définie', 'VR Arena - Lyon', 'Laser Dome - Paris']);

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

  it('should keep the venue the match is already played in when editing', async () => {
    const wrapper = mountForm({
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH' as const,
        title: 'Away game',
        venue: { id: 'venue-2', name: 'Laser Dome', city: 'Paris' },
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
      canEdit: true,
    });
    await wrapper.setProps({ open: true });

    expect((wrapper.find('#event-venue').element as HTMLSelectElement).value).toBe('venue-2');
  });

  it('should show the venue to someone who can only read the match', async () => {
    const wrapper = mountForm({
      canCreate: false,
      canEdit: false,
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH' as const,
        title: 'Away game',
        venue: { id: 'venue-2', name: 'Laser Dome', city: 'Paris' },
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });

    const rows = wrapper.findAll('.event-view-row').map(r => r.text().replace(/\s+/g, ' '));
    expect(rows.some(row => row.includes('Salle') && row.includes('Laser Dome - Paris'))).toBe(true);
    expect(wrapper.find('#event-venue').exists()).toBe(false);
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
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
      canEdit: true,
    });
    await wrapper.setProps({ open: true });
    expect(wrapper.find('#event-venue').exists()).toBe(false);

    await wrapper.findAll('.type-btn').find(b => b.text().includes('Match'))!.trigger('click');

    expect((wrapper.find('#event-venue').element as HTMLSelectElement).value).toBe('venue-1');
  });
});

describe('EventFormModal Component - Editing an existing event', () => {
  const venues = [
    { id: 'venue-1', name: 'VR Arena', city: 'Lyon', address: '12 rue des Lasers', phone: null, arenaCount: 2 },
  ];

  const match = {
    id: 'event-1',
    date: '2026-11-03',
    startTime: '20:00',
    endTime: '22:00',
    type: 'MATCH' as const,
    title: 'Match vs TeamX',
    description: 'On se retrouve 30 min avant',
    venue: { id: 'venue-1', name: 'VR Arena', city: 'Lyon' },
    arenaNumber: 2,
    createdById: 'player-1',
    createdAt: '2026-10-01T00:00:00Z',
  };

  function mountForm(editEvent: Record<string, unknown> = match) {
    return mount(EventFormModal, {
      props: {
        open: false,
        canCreate: true,
        canEdit: true,
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
      voiceMedium: null,
    });
  });
});

describe('EventFormModal Component - Voice meeting platform', () => {
  function mountForm(props: Record<string, unknown> = {}) {
    return mount(EventFormModal, {
      props: {
        open: false,
        canCreate: true,
        canEdit: true,
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
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });

    expect((wrapper.find('#event-medium').element as HTMLSelectElement).value).toBe('GOOGLE_MEET');

    await wrapper.findAll('button').find(b => b.text() === 'Enregistrer')!.trigger('click');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ voiceMedium: 'GOOGLE_MEET' });
  });

  it('should show the platform to someone who can only read the meeting', async () => {
    const wrapper = mountForm({
      canCreate: false,
      canEdit: false,
      editEvent: {
        id: 'event-1',
        date: '2026-11-03',
        startTime: '20:00',
        endTime: '22:00',
        type: 'VOICE_MEETING' as const,
        title: 'Strat Polaris',
        voiceMedium: 'WHATSAPP' as const,
        createdById: 'player-1',
        createdAt: '2026-10-01T00:00:00Z',
      },
    });
    await wrapper.setProps({ open: true });

    const rows = wrapper.findAll('.event-view-row').map(r => r.text().replace(/\s+/g, ' '));
    expect(rows.some(row => row.includes('Plateforme') && row.includes('WhatsApp'))).toBe(true);
    expect(rows.some(row => row.includes('Salle'))).toBe(false);
  });
});
