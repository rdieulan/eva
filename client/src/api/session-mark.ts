// The mark that this browser holds a session. The session itself is a cookie
// the page cannot read: the mark tells the app whether to ask the server who is
// signed in, and lets the other tabs follow a login, a logout or a switch.

const SESSION_MARK = 'session';

/** The account the mark names, or null when this browser holds no session */
export function markedAccountId(): string | null {
  return localStorage.getItem(SESSION_MARK);
}

export function markSession(accountId: string): void {
  localStorage.setItem(SESSION_MARK, accountId);
}

export function unmarkSession(): void {
  localStorage.removeItem(SESSION_MARK);
}

/** Follow the mark as the other tabs change it: the account it now names, or null */
export function onSessionMarkChange(listener: (accountId: string | null) => void): void {
  window.addEventListener('storage', event => {
    if (event.key === SESSION_MARK) listener(event.newValue);
  });
}
