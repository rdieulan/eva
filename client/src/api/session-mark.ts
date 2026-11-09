// The mark that this browser holds a session, and as whom: the account and the
// role it acts as. The session itself is a cookie the page cannot read; the
// mark lets the other tabs follow a login, a logout or a switch of role, which
// the cookie, shared by every tab, carries to all of them at once.

const SESSION_MARK = 'session';

/** The mark of a session: its account and the role it acts as */
export function sessionMarkOf(account: { id: string; accountType: string }): string {
  return `${account.id}:${account.accountType}`;
}

/** The mark this browser holds, null when it holds no session */
export function currentSessionMark(): string | null {
  return localStorage.getItem(SESSION_MARK);
}

export function markSession(account: { id: string; accountType: string }): void {
  localStorage.setItem(SESSION_MARK, sessionMarkOf(account));
}

export function unmarkSession(): void {
  localStorage.removeItem(SESSION_MARK);
}

/** Follow the mark as the other tabs change it: the mark now held, or null */
export function onSessionMarkChange(listener: (mark: string | null) => void): void {
  window.addEventListener('storage', event => {
    if (event.key === SESSION_MARK) listener(event.newValue);
  });
}
