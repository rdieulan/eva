// Tests for the legal pages: who publishes the site and who hosts it, what the
// app does with personal data, and the way to them
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import type { Publisher } from '@shared/types';
import { NOTIFICATION_RETENTION_DAYS } from '@shared/constants';
import { fetchPublisher } from '@/api';
import LegalNoticePage from '@/pages/LegalNoticePage.vue';
import PrivacyPage from '@/pages/PrivacyPage.vue';
import LegalLinks from '@/components/legal/LegalLinks.vue';

vi.mock('@/api', () => ({
  fetchPublisher: vi.fn(),
}));

const PUBLISHER: Publisher = { name: 'Camille Martin', email: 'contact@scrim-calendar.com' };
const UNSET: Publisher = { name: null, email: null };

function mountPage(page: typeof LegalNoticePage | typeof PrivacyPage) {
  return mount(page, { global: { stubs: { RouterLink: RouterLinkStub } } });
}

function sectionOf(wrapper: ReturnType<typeof mountPage>, heading: string) {
  return wrapper.findAll('section').find(candidate => candidate.find('h2').text() === heading)!;
}

// The facts of a section, by its heading: each label with its value
function factsOf(wrapper: ReturnType<typeof mountPage>, heading: string): string[][] {
  return sectionOf(wrapper, heading).findAll('.legal-fact').map(fact => [fact.find('dt').text(), fact.find('dd').text()]);
}

beforeEach(() => {
  vi.mocked(fetchPublisher).mockReset();
});

describe('LegalNoticePage', () => {
  it('says the site is published on a non-professional basis, its publisher known to the host only', async () => {
    const wrapper = mountPage(LegalNoticePage);
    await flushPromises();

    const publisherSection = sectionOf(wrapper, 'Éditeur du site');
    expect(publisherSection.text()).toContain('publié à titre non professionnel par une personne physique');
    expect(publisherSection.text()).toContain('article 1-1, II');
    // Nothing of the publisher: not even asked for
    expect(fetchPublisher).not.toHaveBeenCalled();
    expect(publisherSection.findAll('.legal-fact')).toHaveLength(0);
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Directeur de la publication');
  });

  it('names the host in full, and where the data lies', async () => {
    const wrapper = mountPage(LegalNoticePage);
    await flushPromises();

    expect(factsOf(wrapper, 'Hébergement et stockage des données')).toEqual([
      ['Société', 'Railway Corporation'],
      ['Adresse', '548 Market St PMB 68956, San Francisco, CA 94104, États-Unis'],
      ['Téléphone', '+1 415 707 7675'],
    ]);
    expect(sectionOf(wrapper, 'Hébergement et stockage des données').text()).toContain('Amsterdam (Pays-Bas)');
  });

  it('sends whoever has a question about their data to the page that says where to write', () => {
    const wrapper = mountPage(LegalNoticePage);

    const link = sectionOf(wrapper, 'Données personnelles').findComponent(RouterLinkStub);
    expect(link.props('to')).toEqual({ name: 'privacy' });
  });
});

describe('PrivacyPage when the publisher cannot be read', () => {
  it('says why, and still tells what the app keeps', async () => {
    vi.mocked(fetchPublisher).mockRejectedValue(new Error('502'));
    const wrapper = mountPage(PrivacyPage);
    await flushPromises();

    expect(wrapper.find('.error-display').exists()).toBe(true);
    expect(sectionOf(wrapper, 'Ce que l\'application garde, et pourquoi').findAll('li').length).toBeGreaterThan(0);
  });
});

describe('PrivacyPage', () => {
  it('names who is responsible for the data and where to write, the rights pointing there too', async () => {
    vi.mocked(fetchPublisher).mockResolvedValue(PUBLISHER);
    const wrapper = mountPage(PrivacyPage);
    await flushPromises();

    expect(factsOf(wrapper, 'Qui en est responsable')).toEqual([
      ['Nom', 'Camille Martin'],
      ['E-mail', 'contact@scrim-calendar.com'],
    ]);
    const rights = sectionOf(wrapper, 'Tes droits');
    expect(rights.find('a[href="mailto:contact@scrim-calendar.com"]').exists()).toBe(true);
    expect(rights.find('a[href="https://www.cnil.fr/fr/plaintes"]').exists()).toBe(true);
  });

  it('sends the rights to the top of the page while no address is given', async () => {
    vi.mocked(fetchPublisher).mockResolvedValue(UNSET);
    const wrapper = mountPage(PrivacyPage);
    await flushPromises();

    expect(sectionOf(wrapper, 'Tes droits').text()).toContain('écris à l\'adresse donnée en haut de cette page');
  });

  it('keeps the notifications as long as the app does', async () => {
    vi.mocked(fetchPublisher).mockResolvedValue(PUBLISHER);
    const wrapper = mountPage(PrivacyPage);
    await flushPromises();

    expect(wrapper.text()).toContain(`Tes notifications : ${NOTIFICATION_RETENTION_DAYS} jours.`);
  });
});

describe('LegalLinks', () => {
  it('leads to both legal pages', () => {
    const wrapper = mount(LegalLinks, { global: { stubs: { RouterLink: RouterLinkStub } } });

    expect(wrapper.findAllComponents(RouterLinkStub).map(link => [link.text(), link.props('to')])).toEqual([
      ['Mentions légales', { name: 'legal-notice' }],
      ['Données personnelles', { name: 'privacy' }],
    ]);
  });
});
