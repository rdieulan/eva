// Tests for who publishes the app, read from the deployment's settings: the
// fields given, and the ones the legal pages miss
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { missingPublisherSettings, publisher } from '../../../server/src/utils/publisher';

const SETTINGS = ['PUBLISHER_NAME', 'PUBLISHER_EMAIL'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(SETTINGS.map(name => [name, process.env[name]]));
  for (const name of SETTINGS) delete process.env[name];
});

afterEach(() => {
  for (const name of SETTINGS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe('publisher', () => {
  it('reads each field from its setting, trimmed', () => {
    process.env.PUBLISHER_NAME = '  Camille Martin ';
    process.env.PUBLISHER_EMAIL = 'contact@scrim-calendar.com';

    expect(publisher()).toEqual({ name: 'Camille Martin', email: 'contact@scrim-calendar.com' });
  });

  it('gives null for a field left out or left blank', () => {
    process.env.PUBLISHER_NAME = 'Camille Martin';
    process.env.PUBLISHER_EMAIL = '   ';

    expect(publisher()).toEqual({ name: 'Camille Martin', email: null });
  });
});

describe('missingPublisherSettings', () => {
  it('names the settings the legal pages need and miss', () => {
    expect(missingPublisherSettings()).toEqual(['PUBLISHER_NAME', 'PUBLISHER_EMAIL']);

    process.env.PUBLISHER_NAME = 'Camille Martin';
    expect(missingPublisherSettings()).toEqual(['PUBLISHER_EMAIL']);

    process.env.PUBLISHER_EMAIL = 'contact@scrim-calendar.com';
    expect(missingPublisherSettings()).toEqual([]);
  });
});
