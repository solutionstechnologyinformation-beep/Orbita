import { describe, expect, it } from "vitest";
import { isRecentlyOnline } from "../shared/presence";

describe("presence helper", () => {
  const now = Date.parse("2026-08-13T12:00:00.000Z");

  it("considera online quem foi visto nos últimos cinco minutos", () => {
    expect(isRecentlyOnline(now - 60_000, now)).toBe(true);
    expect(isRecentlyOnline(now - 5 * 60_000, now)).toBe(true);
  });

  it("considera offline quem não tem registro ou excedeu a janela", () => {
    expect(isRecentlyOnline(undefined, now)).toBe(false);
    expect(isRecentlyOnline(now - 5 * 60_000 - 1, now)).toBe(false);
    expect(isRecentlyOnline(now + 1, now)).toBe(false);
  });
});
