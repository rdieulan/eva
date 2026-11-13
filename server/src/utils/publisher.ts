// Who publishes the app, as the legal pages say it (see "Pages légales" in
// docs/PRODUIT.md): read from the deployment's settings, never from the code,
// the repository being public. Read on each call, as the app's address is.

import type { Publisher } from '@shared/types';

// Each field of the publisher, by the setting that holds it
const SETTINGS: Record<keyof Publisher, string> = {
  name: 'PUBLISHER_NAME',
  email: 'PUBLISHER_EMAIL',
};

function setting(name: string): string | null {
  return process.env[name]?.trim() || null;
}

/** The publisher as the deployment sets it; a field not set is null */
export function publisher(): Publisher {
  return { name: setting(SETTINGS.name), email: setting(SETTINGS.email) };
}

/** The settings the legal pages need and the deployment has not set */
export function missingPublisherSettings(): string[] {
  return Object.values(SETTINGS).filter(name => !setting(name));
}
