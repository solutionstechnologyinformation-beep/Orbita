import { describe, expect, it } from "vitest";
import { isBlockedPhaseName, normalizeBlockReason } from "../shared/kanban-block";

describe("kanban block helpers", () => {
  it("identifica variações da fase Bloqueado sem depender de maiúsculas", () => {
    expect(isBlockedPhaseName("Bloqueado")).toBe(true);
    expect(isBlockedPhaseName("BLOQUEADA")).toBe(true);
    expect(isBlockedPhaseName("Em andamento")).toBe(false);
    expect(isBlockedPhaseName(undefined)).toBe(false);
  });

  it("normaliza motivos vazios e preserva motivos preenchidos", () => {
    expect(normalizeBlockReason("  atraso de aprovação  ")).toBe("atraso de aprovação");
    expect(normalizeBlockReason("   ")).toBeNull();
    expect(normalizeBlockReason(null)).toBeNull();
  });
});
