import { describe, expect, it } from "vitest";
import { aggregateCompletedTasksByAssignee } from "../shared/report-summary";

describe("aggregateCompletedTasksByAssignee", () => {
  it("agrega responsáveis e calcula a proporção total", () => {
    const result = aggregateCompletedTasksByAssignee([
      { assigneeName: "Ana" },
      { assigneeName: "Ana" },
      { assigneeName: "Bruno" },
      { assigneeName: null },
    ]);

    expect(result).toEqual([
      { assigneeName: "Ana", count: 2, percentage: 50 },
      { assigneeName: "Bruno", count: 1, percentage: 25 },
      { assigneeName: "Não atribuído", count: 1, percentage: 25 },
    ]);
    expect(result.reduce((sum, row) => sum + row.percentage, 0)).toBe(100);
  });

  it("retorna lista vazia para nenhuma tarefa", () => {
    expect(aggregateCompletedTasksByAssignee([])).toEqual([]);
  });
});
