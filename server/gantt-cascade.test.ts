import { describe, expect, it } from "vitest";
import { propagateTaskDates } from "../shared/gantt-cascade";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("propagateTaskDates", () => {
  it("propaga o atraso em cadeia preservando a duração das sucessoras", () => {
    const updates = propagateTaskDates(
      [
        { id: 1, startDate: date("2026-08-01"), endDate: date("2026-08-02"), dueDate: date("2026-08-02") },
        { id: 2, startDate: date("2026-08-03"), endDate: date("2026-08-05"), dueDate: date("2026-08-05") },
        { id: 3, startDate: date("2026-08-06"), endDate: date("2026-08-06") },
      ],
      [
        { predecessorTaskId: 1, successorTaskId: 2, dependencyType: "finish_to_start" },
        { predecessorTaskId: 2, successorTaskId: 3, dependencyType: "finish_to_start" },
      ],
      1,
      date("2026-08-04"),
      date("2026-08-05"),
    );
    expect(updates).toEqual([
      { id: 1, startDate: date("2026-08-04"), endDate: date("2026-08-05"), dueDate: date("2026-08-05") },
      { id: 2, startDate: date("2026-08-06"), endDate: date("2026-08-08"), dueDate: date("2026-08-08") },
      { id: 3, startDate: date("2026-08-09"), endDate: date("2026-08-09") },
    ]);
  });

  it("não antecipa uma sucessora que já está depois do novo prazo mínimo", () => {
    const updates = propagateTaskDates(
      [
        { id: 1, startDate: date("2026-08-01"), endDate: date("2026-08-02") },
        { id: 2, startDate: date("2026-08-10"), endDate: date("2026-08-12") },
      ],
      [{ predecessorTaskId: 1, successorTaskId: 2, dependencyType: "finish_to_start" }],
      1,
      date("2026-07-30"),
      date("2026-07-31"),
    );
    expect(updates).toEqual([{ id: 1, startDate: date("2026-07-30"), endDate: date("2026-07-31") }]);
  });

  it("rejeita ciclos antes de gerar atualizações parciais", () => {
    expect(() => propagateTaskDates(
      [
        { id: 1, startDate: date("2026-08-01"), endDate: date("2026-08-01") },
        { id: 2, startDate: date("2026-08-02"), endDate: date("2026-08-02") },
      ],
      [
        { predecessorTaskId: 1, successorTaskId: 2 },
        { predecessorTaskId: 2, successorTaskId: 1 },
      ],
      1,
      date("2026-08-03"),
      date("2026-08-03"),
    )).toThrow("ciclo de dependências");
  });
});
