import { describe, expect, it } from "vitest";
import { buildSlaHistory, getSlaPeriodConfig, summarizeSlaEvents, type SlaHistoryEvent } from "./sla-history";

describe("sla history aggregation", () => {
  it("generates correct period config and buckets for month (weekly granularity)", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const config = getSlaPeriodConfig("month", now);
    expect(config.granularity).toBe("week");
    expect(config.bucketCount).toBe(8);
    expect(config.currentStart.getFullYear()).toBe(2026);
    expect(config.currentStart.getMonth()).toBe(7); // August
  });

  it("generates monthly buckets for quarter and year periods", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const quarterConfig = getSlaPeriodConfig("quarter", now);
    expect(quarterConfig.granularity).toBe("month");
    expect(quarterConfig.bucketCount).toBe(6);

    const yearConfig = getSlaPeriodConfig("year", now);
    expect(yearConfig.granularity).toBe("month");
    expect(yearConfig.bucketCount).toBe(12);
  });

  it("summarizes completion events and calculates correct percentage", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const events: SlaHistoryEvent[] = [
      { taskId: 1, completedAt: "2026-08-01T10:00:00.000Z", dueDate: "2026-08-05T10:00:00.000Z" }, // on time
      { taskId: 2, completedAt: "2026-08-02T10:00:00.000Z", dueDate: "2026-08-01T10:00:00.000Z" }, // late
      { taskId: 3, completedAt: "2026-08-03T10:00:00.000Z", dueDate: null },                     // no due date (counted as total but not on time)
    ];
    const summary = summarizeSlaEvents(events, new Date("2026-08-01T00:00:00.000Z"), new Date("2026-09-01T00:00:00.000Z"));
    expect(summary.total).toBe(3);
    expect(summary.onTime).toBe(1);
    expect(summary.sla).toBe(33);
  });

  it("builds history points with labels and valid values", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const config = getSlaPeriodConfig("month", now);
    const events: SlaHistoryEvent[] = [
      { taskId: 10, completedAt: "2026-08-10T10:00:00.000Z", dueDate: "2026-08-12T10:00:00.000Z" },
    ];
    const history = buildSlaHistory(events, config);
    expect(history.length).toBe(8);
    expect(history[0]).toHaveProperty("key");
    expect(history[0]).toHaveProperty("label");
    expect(history[0]).toHaveProperty("sla");
  });
});
