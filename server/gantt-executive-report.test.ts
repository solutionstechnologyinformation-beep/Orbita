import { describe, expect, it } from "vitest";
import {
  buildGanttExecutiveChartData,
  buildGanttExecutivePeriodLabel,
  buildGanttPdfFileName,
  buildGanttTaskReportLink,
  getExecutiveEntryDescription,
  summarizeGanttEntries,
} from "../shared/gantt-executive-report";

const entries = [
  { taskId: 10, operation: "dates_updated", taskTitle: "Tarefa A", relatedTaskTitle: null, beforeData: JSON.stringify({ endDate: "2026-08-15" }), afterData: JSON.stringify({ endDate: "2026-08-17" }), changedByName: "Gestor", changedByEmail: null, createdAt: "2026-08-17T12:00:00.000Z" },
  { taskId: 10, operation: "dependency_created", taskTitle: "Tarefa A", relatedTaskTitle: "Tarefa B", changedByName: null, changedByEmail: "gestor@example.com", createdAt: "2026-08-17T13:00:00.000Z" },
  { taskId: 11, operation: "dependency_deleted", taskTitle: "Tarefa C", relatedTaskTitle: "Tarefa D", changedByName: null, changedByEmail: "gestor@example.com", createdAt: "2026-08-17T14:00:00.000Z" },
];

describe("gantt executive report", () => {
  it("summarizes changes by operation and affected task", () => {
    expect(summarizeGanttEntries(entries)).toEqual({
      totalChanges: 3,
      dateChanges: 1,
      dependenciesCreated: 1,
      dependenciesDeleted: 1,
      affectedTasks: 2,
    });
  });

  it("builds operation, daily and affected-task chart series from real entries", () => {
    const chartData = buildGanttExecutiveChartData(entries);
    expect(chartData.operationBreakdown.map((item) => item.value)).toEqual([1, 1, 1]);
    expect(chartData.dailyVolume).toEqual([{ label: "17/08", value: 3 }]);
    expect(chartData.topAffectedTasks).toEqual([{ label: "Tarefa A", value: 2 }, { label: "Tarefa C", value: 1 }]);
    const impact = buildGanttExecutiveChartData(entries, new Set([10])).impact;
    expect(impact).toMatchObject({ criticalTasksAffected: 1, criticalChanges: 1, criticalDelayedChanges: 1, criticalAcceleratedChanges: 0, criticalNetEndShiftDays: 2, criticalMaxEndShiftDays: 2, totalDelayedChanges: 1, totalAcceleratedChanges: 0, netEndShiftDays: 2, maxEndShiftDays: 2 });
  });

  it("formats the selected calendar period without timezone drift", () => {
    expect(buildGanttExecutivePeriodLabel("2026-08-10", "2026-08-16")).toBe("10/08/2026 a 16/08/2026");
    expect(buildGanttExecutivePeriodLabel()).toBe("Resumo semanal do histórico atual");
  });

  it("creates a safe filename and a contextual Gantt link", () => {
    expect(buildGanttPdfFileName("Strata Engenharia / Goiás")).toBe("orbita-relatorio-executivo-gantt-strata-engenharia-goi-s.pdf");
    expect(buildGanttTaskReportLink("https://orbita.manus.space", 10)).toBe("https://orbita.manus.space/gantt?taskId=10&history=1");
  });

  it("creates a readable entry description", () => {
    expect(getExecutiveEntryDescription(entries[0])).toContain("Tarefa A");
    expect(getExecutiveEntryDescription(entries[1])).toContain("Tarefa B");
  });
});
