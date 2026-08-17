import { describe, expect, it } from "vitest";
import { dateOnlyKey, formatDateInput, formatDateOnly, parseDateInput, toDateOnlyDate } from "./date-only";

describe("date-only", () => {
  it("converte um input de data para o mesmo dia local", () => {
    const parsed = parseDateInput("2026-08-17");
    expect(parsed).not.toBeNull();
    expect(toDateOnlyDate(parsed!)?.getFullYear()).toBe(2026);
    expect(toDateOnlyDate(parsed!)?.getMonth()).toBe(7);
    expect(toDateOnlyDate(parsed!)?.getDate()).toBe(17);
  });

  it("usa os componentes UTC de um timestamp persistido sem recuar um dia", () => {
    const persisted = new Date("2026-08-17T03:00:00.000Z");
    expect(formatDateInput(persisted)).toBe("2026-08-17");
    expect(dateOnlyKey(persisted)).toBe("2026-08-17");
    expect(formatDateOnly(persisted)).toContain("17");
  });

  it("aceita uma string ISO com horário sem alterar o dia do campo", () => {
    expect(formatDateInput("2026-08-17T00:00:00.000Z")).toBe("2026-08-17");
  });

  it("rejeita datas inválidas", () => {
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(formatDateInput("data-invalida")).toBe("");
  });
});
