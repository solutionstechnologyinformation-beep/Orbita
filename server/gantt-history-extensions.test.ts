import { describe, expect, it } from "vitest";
import { buildGanttHistoryCsv } from "../shared/gantt-history";
import { selectGanttManagerIds } from "../shared/gantt-history-notifications";

describe("Gantt history extensions", () => {
  it("builds a UTF-8-ready CSV payload with escaped audit values", () => {
    const csv = buildGanttHistoryCsv([
      {
        createdAt: "2026-08-17T12:00:00.000Z",
        operationLabel: "Datas atualizadas",
        taskTitle: 'Tarefa, "principal"',
        relatedTaskTitle: null,
        changedBy: "Gestor",
        summary: "Datas: 17/08 → 20/08",
        beforeData: '{"startDate":"2026-08-17"}',
        afterData: '{"startDate":"2026-08-20"}',
      },
    ], () => "17/08/2026 09:00");

    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain('"Tarefa, ""principal"""');
    expect(csv).toContain('"17/08/2026 09:00"');
    expect(csv.startsWith('"Data","Operação"')).toBe(true);
  });

  it("notifies only managers in the same tenant and excludes the author", () => {
    expect(selectGanttManagerIds([
      { id: 1, role: "company_admin" },
      { id: 2, role: "leader" },
      { id: 3, role: "user" },
      { id: 4, role: "admin" },
      { id: 1, role: "company_admin" },
    ], 1)).toEqual([2, 4]);
  });
});
