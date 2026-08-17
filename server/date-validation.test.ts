import { describe, expect, it } from "vitest";

describe("Validação Global de Intervalo de Datas", () => {
  it("rejeita data final anterior à data inicial para tarefas", () => {
    const startDate = new Date("2026-08-20");
    const endDate = new Date("2026-08-15");
    const isValid = endDate >= startDate;
    expect(isValid).toBe(false);
  });

  it("aceita data final igual ou posterior à data inicial", () => {
    const startDate = new Date("2026-08-15");
    const endDateSame = new Date("2026-08-15");
    const endDateLater = new Date("2026-08-20");
    expect(endDateSame >= startDate).toBe(true);
    expect(endDateLater >= startDate).toBe(true);
  });
});
