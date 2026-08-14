import { describe, expect, it } from "vitest";
import {
  getTrendComparisonStorageKey,
  isTrendComparisonPeriod,
  readTrendComparisonPeriod,
  TREND_COMPARISON_PERIOD_DESCRIPTIONS,
  TREND_COMPARISON_PERIOD_LABELS,
} from "./dashboard-trend-period";

describe("dashboard trend comparison periods", () => {
  it("exposes the three supported comparison periods", () => {
    expect(TREND_COMPARISON_PERIOD_LABELS).toEqual({ month: "Mês", quarter: "Trimestre", year: "Ano" });
    expect(TREND_COMPARISON_PERIOD_DESCRIPTIONS).toEqual({
      month: "mês anterior",
      quarter: "trimestre anterior",
      year: "ano anterior",
    });
  });

  it("validates supported values and rejects arbitrary input", () => {
    expect(isTrendComparisonPeriod("month")).toBe(true);
    expect(isTrendComparisonPeriod("quarter")).toBe(true);
    expect(isTrendComparisonPeriod("year")).toBe(true);
    expect(isTrendComparisonPeriod("week")).toBe(false);
    expect(isTrendComparisonPeriod(null)).toBe(false);
  });

  it("persists and reads the preference using a user-scoped key", () => {
    const values = new Map<string, string>([[getTrendComparisonStorageKey(42), "quarter"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect(getTrendComparisonStorageKey(42)).toBe("orbita-dashboard-trend-period-42");
    expect(readTrendComparisonPeriod(42, storage)).toBe("quarter");
  });

  it("falls back to month for missing or invalid stored values", () => {
    const missingStorage = { getItem: () => null };
    const invalidStorage = { getItem: () => "week" };
    expect(readTrendComparisonPeriod(42, missingStorage)).toBe("month");
    expect(readTrendComparisonPeriod(42, invalidStorage)).toBe("month");
  });
});
