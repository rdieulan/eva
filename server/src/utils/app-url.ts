// The app's public address, as set for this deployment (APP_URL). Read on each
// call, not once at load: the tests set it for a case and take it back.

/** The address, without a trailing slash; null when none is set */
export function appUrl(): string | null {
  const url = process.env.APP_URL?.trim();
  return url ? url.replace(/\/+$/, '') : null;
}

/** The origin a page of the app sends its requests from; null when no valid address is set */
export function appOrigin(): string | null {
  const url = appUrl();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
