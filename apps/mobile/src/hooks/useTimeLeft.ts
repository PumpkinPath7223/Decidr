import { useEffect, useState } from 'react';
import { formatTimeLeft } from '../utils/time';

/**
 * Live countdown text for a timestamp ("2d 4h", "41m", "25s"), or null once it has passed.
 * Ticks every second in the final minute and every 30 seconds before that.
 */
export function useTimeLeft(targetIso: string): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const remaining = target - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setNow(Date.now());
      return;
    }
    const interval = remaining <= 60_000 ? 1_000 : 30_000;
    // Never sleep past the deadline or past the switch to per-second ticks.
    const untilNext = remaining <= 60_000 ? remaining : remaining - 60_000;
    const delay = Math.max(250, Math.min(interval, untilNext));
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [targetIso, now]);

  return formatTimeLeft(targetIso, now);
}
