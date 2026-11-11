// Tests for VenueEventModal: an event of the team's venue not added yet, and
// the button that adds it to the team's calendar
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VenueEventModal from '@/components/calendar/VenueEventModal.vue';
import { addVenueEventToCalendar } from '@/api';
import { ApiError } from '@/api/error';
import type { VenueEventView } from '@shared/types';

vi.mock('@/api', () => ({
  addVenueEventToCalendar: vi.fn(),
}));

const NIGHT: VenueEventView = {
  id: 'venue-event-1', venueName: 'Nîmes', title: 'Nocturne', date: '2030-06-10', startTime: '21:00', endTime: '23:59',
  description: 'Ouverte à tous, 15 € la soirée',
};

function mountModal(props: Partial<{ event: VenueEventView | null; canAdd: boolean }> = {}) {
  return mount(VenueEventModal, {
    props: { event: NIGHT, canAdd: true, ...props },
    global: { stubs: { Teleport: true } },
  });
}

function button(wrapper: ReturnType<typeof mountModal>, text: string) {
  return wrapper.findAll('button').find(candidate => candidate.text() === text);
}

beforeEach(() => {
  vi.mocked(addVenueEventToCalendar).mockReset();
});

describe('VenueEventModal', () => {
  it('stays closed without an event', () => {
    const wrapper = mountModal({ event: null });
    expect(wrapper.find('.venue-event').exists()).toBe(false);
  });

  it('shows the event, its venue, and that the team has not added it', () => {
    const wrapper = mountModal();

    expect(wrapper.find('.sheet-kind').text()).toBe('📅 Événement de la salle');
    expect(wrapper.find('.event-title').text()).toBe('Nocturne');
    const details = wrapper.findAll('.detail-row').map(row => row.text());
    expect(details).toEqual(['📅 Datelundi 10 juin 2030', '🕐 Horaire21:00 - 23:59', '📍 SalleNîmes']);
    expect(wrapper.find('.event-description').text()).toContain('Ouverte à tous, 15 € la soirée');
    expect(wrapper.find('.not-taken').text()).toBe('Publié par la salle, ouvert à tous : il n\'est pas encore dans le calendrier de l\'équipe.');
  });

  it('adds it to the team\'s calendar, for those who make the team\'s events', async () => {
    vi.mocked(addVenueEventToCalendar).mockResolvedValue({ eventId: 'event-9' });
    const wrapper = mountModal();

    await button(wrapper, 'Ajouter à notre calendrier')!.trigger('click');
    await flushPromises();

    expect(addVenueEventToCalendar).toHaveBeenCalledWith('venue-event-1');
    expect(wrapper.emitted('added')).toHaveLength(1);
  });

  it('says why when it cannot, and stays open', async () => {
    vi.mocked(addVenueEventToCalendar).mockRejectedValue(new ApiError(['Cet événement est passé'], 'fallback'));
    const wrapper = mountModal();

    await button(wrapper, 'Ajouter à notre calendrier')!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Cet événement est passé');
    expect(wrapper.emitted('added')).toBeFalsy();
  });

  it('leaves the adding to those who make the team\'s events, and says so', () => {
    const wrapper = mountModal({ canAdd: false });

    expect(button(wrapper, 'Ajouter à notre calendrier')).toBeUndefined();
    expect(wrapper.find('.not-taken').text()).toContain('Ceux qui gèrent ses événements peuvent l\'y ajouter.');
  });

  it('closes from its button', async () => {
    const wrapper = mountModal();
    await button(wrapper, 'Fermer')!.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
