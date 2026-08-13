import { describe, expect, it } from "vitest";
import { isCompletedKanbanPhase } from "../shared/kanban-completion";

describe("isCompletedKanbanPhase", () => {
  it("reconhece uma fase terminal", () => {
    expect(isCompletedKanbanPhase({ name: "Entregue", isTerminal: true })).toBe(true);
  });

  it("reconhece nomes de etapas concluídas", () => {
    expect(isCompletedKanbanPhase({ name: "Concluído" })).toBe(true);
    expect(isCompletedKanbanPhase({ name: "Publicado" })).toBe(true);
    expect(isCompletedKanbanPhase({ name: "Arquivado" })).toBe(true);
  });

  it("não marca uma etapa aberta como concluída", () => {
    expect(isCompletedKanbanPhase({ name: "Em Andamento", isTerminal: false })).toBe(false);
    expect(isCompletedKanbanPhase(null)).toBe(false);
  });
});
