// In-memory, capped log of every Telegram send this process has made —
// explicitly not persisted (lost on restart, no migration/table) per
// design: this is a "does everything actually work" verification aid
// for testing/event night (see admin/notification-logs), not a durable
// audit trail. Same per-process-array pattern as anything else in this
// app that's deliberately not worth a DB table.
export interface NotificationLogEntry {
  id: number;
  timestamp: Date;
  chatId: string;
  text: string;
  success: boolean;
  error?: string;
}

const MAX_ENTRIES = 200;
const entries: NotificationLogEntry[] = [];
let nextId = 1;

export function logNotification(entry: Omit<NotificationLogEntry, "id" | "timestamp">): void {
  entries.unshift({ id: nextId++, timestamp: new Date(), ...entry });
  entries.length = Math.min(entries.length, MAX_ENTRIES);
}

/** Newest first. */
export function getRecentNotifications(): NotificationLogEntry[] {
  return entries;
}
