import { describe, expect, it } from "vitest";
import { buildKanbanUrl, buildTaskDetailUrl, getKanbanReturnUrl, parseKanbanUrlState } from "../../shared/kanban-navigation";

describe("navegação contextual do Kanban", () => {
  it("serializa contrato, disciplinas e filtros na URL do Kanban", () => {
    const url = buildKanbanUrl({
      crsId: 42,
      disciplines: ["Estruturas", "Pavimentação"],
      search: "ponte",
      priority: "high",
      assignee: "8",
      company: "Strata Engenharia",
      client: "3",
      scrollTop: 412,
      scrollLeft: 86,
    });

    expect(url).toContain("crs=42");
    expect(url).toContain("discipline=Estruturas");
    expect(url).toContain("discipline=Pavimenta%C3%A7%C3%A3o");
    expect(url).toContain("search=ponte");
    expect(parseKanbanUrlState(url.replace("/kanban", ""))).toEqual({
      crsId: 42,
      disciplines: ["Estruturas", "Pavimentação"],
      search: "ponte",
      priority: "high",
      assignee: "8",
      company: "Strata Engenharia",
      client: "3",
      scrollTop: 412,
      scrollLeft: 86,
    });
  });

  it("anexa as posições de rolagem ao retorno do detalhe da tarefa", () => {
    const url = buildTaskDetailUrl(99, { crsId: 42, disciplines: ["Geotecnia"], scrollTop: 280, scrollLeft: 64 });
    const returnTo = new URLSearchParams(url.split("?")[1]).get("returnTo");
    expect(returnTo).toBe("/kanban?crs=42&discipline=Geotecnia&scrollTop=280&scrollLeft=64");
  });

  it("anexa o retorno contextual ao detalhe da tarefa", () => {
    const url = buildTaskDetailUrl(99, { crsId: 42, disciplines: ["Geotecnia"] });
    const returnTo = new URLSearchParams(url.split("?")[1]).get("returnTo");
    expect(returnTo).toBe("/kanban?crs=42&discipline=Geotecnia");
  });

  it("usa o retorno contextual e mantém fallback seguro para o contrato da tarefa", () => {
    expect(getKanbanReturnUrl("?returnTo=%2Fkanban%3Fcrs%3D42%26discipline%3DGeotecnia", 7)).toBe("/kanban?crs=42&discipline=Geotecnia");
    expect(getKanbanReturnUrl("", 7)).toBe("/kanban?crs=7");
    expect(getKanbanReturnUrl("?returnTo=%2Fprojects", 7)).toBe("/kanban?crs=7");
  });
});
