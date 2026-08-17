export type GanttDateValue = Date | string | null | undefined;

export function asGanttDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfGanttDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addGanttDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

export function ganttDayDistance(from: Date, to: Date) {
  return Math.round((startOfGanttDay(to).getTime() - startOfGanttDay(from).getTime()) / 86400000);
}

export function formatGanttExactDate(value: GanttDateValue) {
  const date = asGanttDate(value);
  return date ? date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "Sem data";
}

export function getGanttWeekStart(value: Date) {
  const date = startOfGanttDay(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addGanttDays(date, -mondayOffset);
}

export function formatGanttWeekLabel(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const endLabel = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  return start.getMonth() === end.getMonth() ? `${startLabel.split(" ")[0]}–${endLabel}` : `${startLabel}–${endLabel}`;
}

export function getGanttDurationDays(startValue: GanttDateValue, endValue: GanttDateValue) {
  const start = asGanttDate(startValue);
  const end = asGanttDate(endValue) ?? start;
  if (!start) return 0;
  return Math.max(1, ganttDayDistance(start, end ?? start) + 1);
}

export function getGanttTaskRange(startValue: GanttDateValue, endValue: GanttDateValue) {
  const start = asGanttDate(startValue);
  const end = asGanttDate(endValue) ?? start;
  return { start, end };
}
