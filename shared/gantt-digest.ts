export type GanttDigestWindow = {
  start: Date;
  end: Date;
  key: string;
};

export function buildGanttDigestWindow(now = new Date()): GanttDigestWindow {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    start,
    end,
    key: `${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`,
  };
}

export function buildGanttTaskDeepLink(baseUrl: string, taskId: number) {
  if (!Number.isInteger(taskId) || taskId <= 0) throw new Error("taskId inválido");
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const parsedBaseUrl = new URL(normalizedBaseUrl);
  if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.protocol !== "http:") throw new Error("URL pública inválida");
  const url = new URL("gantt", parsedBaseUrl);
  url.searchParams.set("taskId", String(taskId));
  url.searchParams.set("history", "1");
  return url.toString();
}

export function buildWeeklyGanttDigestCron(dayOfWeek: number, hourUtc: number, minuteUtc: number) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new Error("Dia da semana inválido.");
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) throw new Error("Hora UTC inválida.");
  if (!Number.isInteger(minuteUtc) || minuteUtc < 0 || minuteUtc > 59) throw new Error("Minuto UTC inválido.");
  return `0 ${minuteUtc} ${hourUtc} * * ${dayOfWeek}`;
}

export function calculateNextWeeklyGanttDigest(dayOfWeek: number, hourUtc: number, minuteUtc: number, now = new Date()) {
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(hourUtc, minuteUtc, 0, 0);
  const daysAhead = (dayOfWeek - next.getUTCDay() + 7) % 7;
  if (daysAhead === 0 && next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCDate(next.getUTCDate() + daysAhead);
  return next;
}

export const GANTT_DIGEST_PATH = "/api/scheduled/weekly-gantt-digest";
