const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function relativeTime(modifiedMs: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - modifiedMs);

  if (elapsed < MINUTE_MS) {
    return "Just now";
  }

  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} min ago`;
  }

  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} hr ago`;
  }

  const days = Math.floor(elapsed / DAY_MS);
  return `${days} d ago`;
}
