export function isRecentlyOnline(value: Date | string | number | null | undefined, now = Date.now(), windowMs = 5 * 60 * 1000): boolean {
  if (value == null) return false;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= windowMs;
}
