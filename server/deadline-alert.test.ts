import { describe, expect, it } from "vitest";
import { getDeadlineAlertWindow, normalizeDeadlineAlertDays } from "../shared/deadline-alert";

describe("deadline alert settings", () => {
  it("aceita apenas 1, 3 ou 7 dias e usa 3 como fallback", () => {
    expect(normalizeDeadlineAlertDays(1)).toBe(1);
    expect(normalizeDeadlineAlertDays(3)).toBe(3);
    expect(normalizeDeadlineAlertDays(7)).toBe(7);
    expect(normalizeDeadlineAlertDays(5)).toBe(3);
    expect(normalizeDeadlineAlertDays(undefined)).toBe(3);
  });

  it("calcula a janela a partir do instante atual", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    expect(getDeadlineAlertWindow(now, 7).toISOString()).toBe("2026-08-21T12:00:00.000Z");
    expect(getDeadlineAlertWindow(now, 99).toISOString()).toBe("2026-08-17T12:00:00.000Z");
  });
});
