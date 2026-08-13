import { describe, expect, it } from "vitest";
import { matchesKanbanTaskSearch } from "../shared/kanban-search";

describe("matchesKanbanTaskSearch", () => {
  const task = {
    title: "Revisar projeto executivo",
    assigneeName: "Ana Paula",
    projectName: "BH Shopping",
    setor: "Implantação",
  };

  it("encontra pelo título do card sem diferenciar maiúsculas", () => {
    expect(matchesKanbanTaskSearch(task, "PROJETO EXECUTIVO")).toBe(true);
  });

  it("encontra pelo nome do responsável", () => {
    expect(matchesKanbanTaskSearch(task, "ana paula")).toBe(true);
  });

  it("encontra por contrato ou disciplina", () => {
    expect(matchesKanbanTaskSearch(task, "shopping")).toBe(true);
    expect(matchesKanbanTaskSearch(task, "implantação")).toBe(true);
  });

  it("retorna true para consulta vazia e false quando não há correspondência", () => {
    expect(matchesKanbanTaskSearch(task, "  ")).toBe(true);
    expect(matchesKanbanTaskSearch(task, "responsável inexistente")).toBe(false);
  });
});
