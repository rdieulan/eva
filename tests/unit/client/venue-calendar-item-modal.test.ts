// Tests for VenueCalendarItemModal: what a venue's calendar holds, looked at
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import VenueCalendarItemModal from '@/components/calendar/VenueCalendarItemModal.vue';
import type { VenueCalendarItem } from '@shared/types';

const COMPETITION: VenueCalendarItem = {
  type: 'COMPETITION', id: 'competition-1', division: 2, title: 'Journée de la Division 2', date: '2026-11-28',
  startTime: '14:00', endTime: '19:00', description: 'Convocation 13:30', answers: { pending: 1, accepted: 2, refused: 0 },
};

const NIGHT: VenueCalendarItem = {
  type: 'EVENT', id: 'event-1', venueName: 'Nîmes', title: 'Nocturne', date: '2026-11-13', startTime: '21:00', endTime: '23:59',
  description: null, teamsAdding: 1,
};

const MATCH: VenueCalendarItem = {
  type: 'MATCH', id: 'match-1', date: '2026-11-24', startTime: '19:00', endTime: '20:20', title: 'Calme Plat · Scrim vs Orbit',
  arenaNumber: 1, slotCount: 2, fromMatchmaking: false, teams: [{ id: 't1', name: 'Calme Plat', logoUrl: null }],
};

function mountModal(item: VenueCalendarItem | null) {
  return mount(VenueCalendarItemModal, { props: { item }, global: { stubs: { Teleport: true } } });
}

function rows(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.findAll('.detail-row').map(row => `${row.find('.detail-label').text()} = ${row.find('.detail-value').text()}`);
}

describe('VenueCalendarItemModal', () => {
  it('stays closed without an item', () => {
    expect(mountModal(null).find('.event-sheet').exists()).toBe(false);
  });

  it('shows a competition: which, and what its teams answered', () => {
    const wrapper = mountModal(COMPETITION);

    expect(wrapper.find('.sheet-kind').text()).toBe('🏆 Compétition');
    expect(wrapper.find('.event-title').text()).toBe('Journée de la Division 2');
    expect(rows(wrapper)).toEqual([
      '📅 Date = samedi 28 novembre 2026',
      '🕐 Horaire = 14:00 - 19:00',
      '🏆 Compétition = Division 2',
      '📨 Réponses = Proposée à 3 équipes · 2 l\'ont ajoutée · 1 sans réponse.',
    ]);
    expect(wrapper.find('.event-description').text()).toContain('Convocation 13:30');
  });

  it('shows an event and how many teams added it', () => {
    const wrapper = mountModal(NIGHT);

    expect(wrapper.find('.sheet-kind').text()).toBe('📅 Événement');
    expect(rows(wrapper)).toContain('👥 Équipes = Ajouté au calendrier de 1 équipe.');
    expect(wrapper.find('.event-description').exists()).toBe(false);
  });

  it('shows a match, its slots, its teams and where it comes from', () => {
    const wrapper = mountModal(MATCH);

    expect(wrapper.find('.sheet-kind').text()).toBe('🎮 Match');
    expect(rows(wrapper)).toEqual([
      '📅 Date = mardi 24 novembre 2026',
      '🕐 Horaire = 19:00 - 20:20 2 créneaux',
      '👥 Équipe = Calme Plat',
      '📍 Arène = Arène 1',
      '🤝 Origine = Saisi par l\'équipe',
    ]);
  });

  it('closes from its button', async () => {
    const wrapper = mountModal(MATCH);
    await wrapper.find('.btn-close-sheet').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
