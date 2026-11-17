const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2d 4h", "3h 12m", "41m", "25s" — or null once the moment has passed. */
export function formatTimeLeft(targetIso: string, now: number = Date.now()): string | null {
  const ms = new Date(targetIso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;

  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (ms >= MINUTE) return `${Math.floor(ms / MINUTE)}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function formatTimeAgo(iso: string, now: number = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d ago`;
  return new Date(iso).toLocaleDateString();
}
