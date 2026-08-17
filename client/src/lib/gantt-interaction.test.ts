import { describe, expect, it } from "vitest";
import { calculateDateEditRange, canCreateDependency } from "./gantt-interaction";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("gantt-interaction", () => {
  it("move a barra preservando sua duração", () => {
    const range = calculateDateEditRange(date("2026-08-10"), date("2026-08-12"), date("2026-08-11"), date("2026-08-14"), "move");
    expect(range).toEqual({ start: date("2026-08-13"), end: date("2026-08-15") });
  });

  it("impede que o redimensionamento inverta o intervalo", () => {
    expect(calculateDateEditRange(date("2026-08-10"), date("2026-08-12"), date("2026-08-10"), date("2026-08-15"), "resize-start")).toEqual({ start: date("2026-08-12"), end: date("2026-08-12") });
    expect(calculateDateEditRange(date("2026-08-10"), date("2026-08-12"), date("2026-08-12"), date("2026-08-08"), "resize-end")).toEqual({ start: date("2026-08-10"), end: date("2026-08-10") });
  });

  it("aceita somente dependências entre tarefas diferentes", () => {
    expect(canCreateDependency(1, 2)).toBe(true);
    expect(canCreateDependency(1, 1)).toBe(false);
    expect(canCreateDependency(1, undefined)).toBe(false);
  });
});
