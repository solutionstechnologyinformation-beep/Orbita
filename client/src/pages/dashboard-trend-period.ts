export type TrendComparisonPeriod = "month" | "quarter" | "year";

export const TREND_COMPARISON_PERIODS: readonly TrendComparisonPeriod[] = ["month", "quarter", "year"] as const;

export const TREND_COMPARISON_PERIOD_LABELS: Record<TrendComparisonPeriod, string> = {
  month: "Mês",
  quarter: "Trimestre",
  year: "Ano",
};

export const TREND_COMPARISON_PERIOD_DESCRIPTIONS: Record<TrendComparisonPeriod, string> = {
  month: "mês anterior",
  quarter: "trimestre anterior",
  year: "ano anterior",
};

export function isTrendComparisonPeriod(value: unknown): value is TrendComparisonPeriod {
  return typeof value === "string" && TREND_COMPARISON_PERIODS.includes(value as TrendComparisonPeriod);
}

export function getTrendComparisonStorageKey(userId: number | string | undefined) {
  return userId === undefined ? "orbita-dashboard-trend-period" : `orbita-dashboard-trend-period-${userId}`;
}

export function readTrendComparisonPeriod(userId: number | string | undefined, storage?: Pick<Storage, "getItem">): TrendComparisonPeriod {
  const fallback: TrendComparisonPeriod = "month";
  const store = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return fallback;
  try {
    const value = store.getItem(getTrendComparisonStorageKey(userId));
    return isTrendComparisonPeriod(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
