import { describe, expect, it } from "vitest";
import { getQuickCommandVisualState } from "./quick-command-state";

describe("Orbita AI quick command visual state", () => {
  it("shows loading feedback immediately on the selected command", () => {
    expect(getQuickCommandVisualState("Ver minha agenda", "Ver minha agenda", true, false, "Consultar compromissos")).toEqual({
      isLoading: true,
      isDisabled: true,
      title: "Consultando...",
      description: "Processando sua solicitação",
    });
  });

  it("disables other commands while one command is active", () => {
    const state = getQuickCommandVisualState("Abrir projetos", "Ver minha agenda", true, false, "Acessar contratos e CRS");
    expect(state.isLoading).toBe(false);
    expect(state.isDisabled).toBe(true);
    expect(state.title).toBe("Abrir projetos");
  });

  it("keeps commands available when no request is active", () => {
    expect(getQuickCommandVisualState("Abrir o Kanban", null, false, false, "Ver e organizar tarefas").isDisabled).toBe(false);
  });
});
