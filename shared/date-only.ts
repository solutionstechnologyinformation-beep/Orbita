export type DateOnlyValue = Date | string | number;

export interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidParts(parts: DateOnlyParts) {
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return probe.getUTCFullYear() === parts.year
    && probe.getUTCMonth() === parts.month - 1
    && probe.getUTCDate() === parts.day;
}

/** Extracts the calendar day from a date-only string or a persisted timestamp.
 * Persisted timestamps are read through UTC components so a local midnight stored
 * as 00:00/03:00 UTC never becomes the previous local day in the UI.
 */
export function getDateOnlyParts(value: DateOnlyValue): DateOnlyParts | null {
  if (typeof value === "string") {
    const match = DATE_ONLY_PATTERN.exec(value.slice(0, 10));
    if (match && value.length >= 10) {
      const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
      return isValidParts(parts) ? parts : null;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  return isValidParts(parts) ? parts : null;
}

/** Converts a date input (YYYY-MM-DD) to local midnight for persistence. */
export function parseDateInput(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (!isValidParts(parts)) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Converts a persisted date to the value expected by <input type="date">. */
export function formatDateInput(value: DateOnlyValue | null | undefined): string {
  if (value == null) return "";
  const parts = getDateOnlyParts(value);
  if (!parts) return "";
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

/** Formats a date-only value without applying the browser's local timezone. */
export function formatDateOnly(value: DateOnlyValue | null | undefined, locale = "pt-BR"): string {
  if (value == null) return "—";
  const parts = getDateOnlyParts(value);
  if (!parts) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
    .replace(".", "");
}

export function toDateOnlyDate(value: DateOnlyValue | null | undefined): Date | null {
  if (value == null) return null;
  const parts = getDateOnlyParts(value);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

export function dateOnlyKey(value: DateOnlyValue | null | undefined): string | null {
  const input = formatDateInput(value as DateOnlyValue);
  return input || null;
}
