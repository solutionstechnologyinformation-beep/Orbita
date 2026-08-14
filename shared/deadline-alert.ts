export const DEADLINE_ALERT_OPTIONS = [1, 3, 7] as const;
export type DeadlineAlertDays = (typeof DEADLINE_ALERT_OPTIONS)[number];

export function normalizeDeadlineAlertDays(value: unknown): DeadlineAlertDays {
  const numeric = Number(value);
  return DEADLINE_ALERT_OPTIONS.includes(numeric as DeadlineAlertDays) ? numeric as DeadlineAlertDays : 3;
}

export function getDeadlineAlertWindow(now: Date, days: unknown): Date {
  const normalized = normalizeDeadlineAlertDays(days);
  return new Date(now.getTime() + normalized * 86400000);
}
