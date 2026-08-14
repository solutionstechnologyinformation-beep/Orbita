export type SlaPeriod = "month" | "quarter" | "year";
export type SlaHistoryGranularity = "week" | "month";

export type SlaHistoryEvent = {
  taskId: number;
  completedAt: Date | string;
  dueDate?: Date | string | null;
};

export type SlaHistoryPoint = {
  key: string;
  label: string;
  total: number;
  onTime: number;
  sla: number | null;
};

export type SlaPeriodConfig = {
  currentStart: Date;
  previousStart: Date;
  previousEndExclusive: Date;
  queryStart: Date;
  queryEndExclusive: Date;
  historyStart: Date;
  granularity: SlaHistoryGranularity;
  bucketCount: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - daysSinceMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * MS_PER_DAY);
}

export function getSlaPeriodConfig(period: SlaPeriod, now = new Date()): SlaPeriodConfig {
  const currentDate = new Date(now);
  const currentMonth = startOfMonth(currentDate);
  let currentStart: Date;
  let previousStart: Date;
  let granularity: SlaHistoryGranularity;
  let bucketCount: number;
  let historyStart: Date;

  if (period === "month") {
    currentStart = currentMonth;
    previousStart = addMonths(currentMonth, -1);
    granularity = "week";
    bucketCount = 8;
    historyStart = addDays(startOfWeek(currentDate), -(bucketCount - 1) * 7);
  } else if (period === "quarter") {
    const quarterStartMonth = Math.floor(currentDate.getMonth() / 3) * 3;
    currentStart = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
    previousStart = new Date(currentDate.getFullYear(), quarterStartMonth - 3, 1);
    granularity = "month";
    bucketCount = 6;
    historyStart = addMonths(currentMonth, -(bucketCount - 1));
  } else {
    currentStart = new Date(currentDate.getFullYear(), 0, 1);
    previousStart = new Date(currentDate.getFullYear() - 1, 0, 1);
    granularity = "month";
    bucketCount = 12;
    historyStart = currentStart;
  }

  const queryStart = previousStart.getTime() < historyStart.getTime() ? previousStart : historyStart;
  return {
    currentStart,
    previousStart,
    previousEndExclusive: currentStart,
    queryStart,
    queryEndExclusive: new Date(currentDate.getTime() + 1),
    historyStart,
    granularity,
    bucketCount,
  };
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getMonthIndex(start: Date, date: Date) {
  return (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
}

export function summarizeSlaEvents(events: SlaHistoryEvent[], start: Date, endExclusive: Date) {
  const totalTaskIds = new Set<number>();
  const onTimeTaskIds = new Set<number>();
  const startTime = start.getTime();
  const endTime = endExclusive.getTime();

  for (const event of events) {
    const completedAt = toDate(event.completedAt);
    if (!completedAt) continue;
    const completedTime = completedAt.getTime();
    if (completedTime < startTime || completedTime >= endTime) continue;

    totalTaskIds.add(event.taskId);
    const dueDate = toDate(event.dueDate);
    if (dueDate && completedTime <= dueDate.getTime()) onTimeTaskIds.add(event.taskId);
  }

  const total = totalTaskIds.size;
  const onTime = onTimeTaskIds.size;
  return {
    total,
    onTime,
    sla: total > 0 ? Math.round((onTime / total) * 100) : null,
  };
}

export function buildSlaHistory(events: SlaHistoryEvent[], config: SlaPeriodConfig): SlaHistoryPoint[] {
  const bucketSets = Array.from({ length: config.bucketCount }, () => ({
    totalTaskIds: new Set<number>(),
    onTimeTaskIds: new Set<number>(),
  }));

  for (const event of events) {
    const completedAt = toDate(event.completedAt);
    if (!completedAt) continue;
    if (completedAt < config.historyStart || completedAt >= config.queryEndExclusive) continue;

    const index = config.granularity === "week"
      ? Math.floor((completedAt.getTime() - config.historyStart.getTime()) / MS_PER_WEEK)
      : getMonthIndex(config.historyStart, completedAt);
    if (index < 0 || index >= bucketSets.length) continue;

    const bucket = bucketSets[index];
    bucket.totalTaskIds.add(event.taskId);
    const dueDate = toDate(event.dueDate);
    if (dueDate && completedAt.getTime() <= dueDate.getTime()) bucket.onTimeTaskIds.add(event.taskId);
  }

  return bucketSets.map((bucket, index) => {
    const bucketStart = config.granularity === "week"
      ? addDays(config.historyStart, index * 7)
      : addMonths(config.historyStart, index);
    const total = bucket.totalTaskIds.size;
    const onTime = bucket.onTimeTaskIds.size;
    return {
      key: `${config.granularity}-${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, "0")}-${String(bucketStart.getDate()).padStart(2, "0")}`,
      label: formatSlaHistoryLabel(bucketStart, config.granularity),
      total,
      onTime,
      sla: total > 0 ? Math.round((onTime / total) * 100) : null,
    };
  });
}

export function formatSlaHistoryLabel(date: Date, granularity: SlaHistoryGranularity) {
  if (granularity === "week") {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}
