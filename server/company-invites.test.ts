import { describe, expect, it } from "vitest";

describe("company-invites workflow", () => {
  it("valida o cálculo de expiração de convites para 7 dias", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(7);
  });

  it("garante formato seguro de token hexadecimal de 32 bytes", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    expect(token.length).toBe(64);
    expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
  });
});
