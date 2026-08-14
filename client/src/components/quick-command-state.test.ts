import { describe, expect, it } from "vitest";
import { getQuickCommandVisualState, QUICK_COMMAND_HOVER_CLASSES } from "./quick-command-state";

describe("Orbita AI quick command visual state", () => {
  it("defines a smooth and accessible hover treatment", () => {
    expect(QUICK_COMMAND_HOVER_CLASSES).toContain("transition duration-300 ease-out");
    expect(QUICK_COMMAND_HOVER_CLASSES).toContain("hover:-translate-y-1");
    expect(QUICK_COMMAND_HOVER_CLASSES).toContain("hover:scale-[1.01]");
    expect(QUICK_COMMAND_HOVER_CLASSES).toContain("focus-visible:ring-2");
    expect(QUICK_COMMAND_HOVER_CLASSES).toContain("motion-reduce:transition-none");
    expect(QUICK_COMMAND_HOVER_CLASSES).toContain("disabled:shadow-none");
  });
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
