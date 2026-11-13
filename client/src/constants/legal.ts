// What the legal pages say of the app's host: Railway, the service the app
// and its database are deployed on, in its Europe region. Moving to another
// host or region changes these, and the pages with them.
export const HOST = {
  name: 'Railway Corporation',
  address: '548 Market St PMB 68956, San Francisco, CA 94104, États-Unis',
  phone: '+1 415 707 7675',
  dataLocation: 'Amsterdam (Pays-Bas)',
  privacyPolicyUrl: 'https://railway.com/legal/privacy',
} as const;

// When the page on personal data last changed, as it reads: a change of what
// the app keeps, who sees it or for how long changes the page and this date
export const PRIVACY_UPDATED = '13 novembre 2026';

// Where a person complains to the French data protection authority
export const CNIL_COMPLAINT_URL = 'https://www.cnil.fr/fr/plaintes';
