import { describe, expect, it } from "vitest";
import { isKanbanTaskCompleted, isKanbanTaskOverdue } from "../shared/kanban-card-state";
import { getKanbanPhaseDisplayName } from "../shared/kanban-labels";

describe("kanban completed card state", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  const overdueDate = "2026-08-13T12:00:00.000Z";

  it("treats 100% progress and terminal phases as completed", () => {
    expect(isKanbanTaskCompleted({ progress: 100 }, { name: "Em Andamento" })).toBe(true);
    expect(isKanbanTaskCompleted({ progress: 75 }, { name: "Concluído" })).toBe(true);
    expect(isKanbanTaskCompleted({ progress: 75 }, { name: "Arquivado" })).toBe(true);
  });

  it("does not mark completed cards as overdue", () => {
    expect(isKanbanTaskOverdue({ progress: 100, dueDate: overdueDate }, { name: "Em Andamento" }, now)).toBe(false);
    expect(isKanbanTaskOverdue({ progress: 75, dueDate: overdueDate }, { name: "Concluído" }, now)).toBe(false);
    expect(isKanbanTaskOverdue({ progress: 50, dueDate: overdueDate }, { name: "Em Andamento" }, now)).toBe(true);
  });

  it("displays the legacy archived phase as Concluído", () => {
    expect(getKanbanPhaseDisplayName("Arquivado")).toBe("Concluído");
    expect(getKanbanPhaseDisplayName("Concluído")).toBe("Concluído");
  });
});
