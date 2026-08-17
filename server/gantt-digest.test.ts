import { describe, expect, it } from "vitest";
import { buildWeeklyGanttDigestCron, buildGanttDigestWindow, buildGanttTaskDeepLink, calculateNextWeeklyGanttDigest } from "../shared/gantt-digest";
import { buildGanttDigestEmailHtml, describeGanttDigestEntry } from "./gantt-digest-email";

describe("gantt digest scheduling", () => {
  it("builds a UTC seven-day window without changing calendar dates", () => {
    const window = buildGanttDigestWindow(new Date("2026-08-17T18:00:00.000Z"));
    expect(window.start.toISOString()).toBe("2026-08-11T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-08-17T23:59:59.999Z");
    expect(window.key).toBe("2026-08-11:2026-08-17");
  });

  it("creates a weekly cron and calculates the next occurrence", () => {
    expect(buildWeeklyGanttDigestCron(1, 9, 30)).toBe("0 30 9 * * 1");
    expect(buildGanttTaskDeepLink("https://orbita.manus.space", 42)).toBe("https://orbita.manus.space/gantt?taskId=42&history=1");
    expect(() => buildGanttTaskDeepLink("javascript:alert(1)", 42)).toThrow("URL pública inválida");
    expect(calculateNextWeeklyGanttDigest(1, 9, 30, new Date("2026-08-17T08:00:00.000Z")).toISOString()).toBe("2026-08-17T09:30:00.000Z");
    expect(calculateNextWeeklyGanttDigest(1, 9, 30, new Date("2026-08-17T10:00:00.000Z")).toISOString()).toBe("2026-08-24T09:30:00.000Z");
  });
});

describe("gantt digest email", () => {
  const entry = {
    taskId: 42,
    operation: "dates_updated",
    taskTitle: "Trecho <A>",
    relatedTaskTitle: null,
    changedByName: "Gestor",
    changedByEmail: "gestor@example.com",
    beforeData: JSON.stringify({ startDate: "2026-08-17", endDate: "2026-08-20" }),
    afterData: JSON.stringify({ startDate: "2026-08-18", endDate: "2026-08-22" }),
    createdAt: "2026-08-18T12:00:00.000Z",
  } as const;

  it("describes a date change with the exact calendar day", () => {
    expect(describeGanttDigestEntry(entry)).toContain("17 de ago de 2026");
    expect(describeGanttDigestEntry(entry)).toContain("18 de ago de 2026");
  });

  it("escapes tenant data before embedding it into email HTML", () => {
    const html = buildGanttDigestEmailHtml({ companyName: "Empresa <segura>", windowLabel: "10/08/2026 a 17/08/2026", entries: [entry], baseUrl: "https://orbita.manus.space" });
    expect(html).toContain("https://orbita.manus.space/gantt?taskId=42&amp;history=1");
    expect(html).toContain("Abrir no Gantt");
    expect(html).toContain("Empresa &lt;segura&gt;");
    expect(html).toContain("Trecho &lt;A&gt;");
    expect(html).not.toContain("<A>");
  });
});
