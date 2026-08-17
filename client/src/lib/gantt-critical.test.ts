import { describe, expect, it } from "vitest";
import { getCriticalTaskIds } from "./gantt-critical";

describe("getCriticalTaskIds", () => {
  it("retorna a cadeia de maior duração entre as dependências", () => {
    const critical = getCriticalTaskIds([
      { id: 1, durationDays: 2, dependencies: [] },
      { id: 2, durationDays: 4, dependencies: [{ predecessorTaskId: 1, successorTaskId: 2 }] },
      { id: 3, durationDays: 2, dependencies: [{ predecessorTaskId: 2, successorTaskId: 3 }] },
      { id: 4, durationDays: 10, dependencies: [] },
    ]);
    expect([...critical]).toEqual([1, 2, 3]);
  });

  it("não marca tarefas isoladas quando não existe dependência", () => {
    const critical = getCriticalTaskIds([
      { id: 1, durationDays: 20 },
      { id: 2, durationDays: 1 },
    ]);
    expect(critical.size).toBe(0);
  });

  it("ignora vínculos para tarefas que não estão na visão atual", () => {
    const critical = getCriticalTaskIds([
      { id: 1, durationDays: 2, dependencies: [{ predecessorTaskId: 1, successorTaskId: 99 }] },
      { id: 2, durationDays: 4 },
    ]);
    expect(critical.size).toBe(0);
  });
});
