// Notification constants

// The bell lists the latest notifications only: older ones are history nobody scrolls to
export const NOTIFICATION_INBOX_SIZE = 30;

// A notification is kept a month, then deleted with its inbox entries
export const NOTIFICATION_RETENTION_DAYS = 30;

// How often an open tab asks how many notifications are unread: the market moves in minutes, not seconds
export const NOTIFICATION_POLL_INTERVAL_MS = 60 * 1000;
