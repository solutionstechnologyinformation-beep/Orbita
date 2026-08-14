import { describe, expect, it } from "vitest";
import { getKanbanStatusForPhase } from "../shared/kanban-status";

describe("kanban phase status mapping", () => {
  it("maps workflow columns to persisted statuses", () => {
    expect(getKanbanStatusForPhase("Para Iniciar")).toBe("pending");
    expect(getKanbanStatusForPhase("Em Andamento")).toBe("in_progress");
    expect(getKanbanStatusForPhase("Compartilhado")).toBe("shared");
    expect(getKanbanStatusForPhase("Publicado")).toBe("published");
    expect(getKanbanStatusForPhase("Concluído")).toBe("archived");
    expect(getKanbanStatusForPhase("Arquivado")).toBe("archived");
    expect(getKanbanStatusForPhase("Bloqueado")).toBe("blocked");
  });

  it("reopens a blocked task when it moves to an unknown non-blocked phase", () => {
    expect(getKanbanStatusForPhase("Revisão", "blocked")).toBe("in_progress");
    expect(getKanbanStatusForPhase("Revisão", "pending")).toBe("pending");
  });
});
