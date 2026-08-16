import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./password-strength";

describe("password-strength", () => {
  it("retorna estado inicial sem expor requisitos enquanto a senha está vazia", () => {
    expect(getPasswordStrength("")).toEqual({
      score: 0,
      label: "Digite sua senha",
      isCompliant: false,
      missingRequirements: [],
    });
  });

  it("identifica quando a senha atende à política padrão", () => {
    const result = getPasswordStrength("senhasegura9");
    expect(result.isCompliant).toBe(true);
    expect(result.missingRequirements).toEqual([]);
    expect(result.score).toBe(2);
  });

  it("lista os requisitos configurados que ainda faltam", () => {
    const result = getPasswordStrength("senha", {
      minLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: true,
    });
    expect(result.isCompliant).toBe(false);
    expect(result.missingRequirements).toEqual([
      "Use pelo menos 12 caracteres.",
      "Inclua uma letra maiúscula.",
      "Inclua um número.",
      "Inclua um caractere especial.",
    ]);
  });

  it("classifica uma senha completa como muito forte e compatível", () => {
    const result = getPasswordStrength("Senha-segura9!", {
      minLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: true,
    });
    expect(result.label).toBe("Muito forte");
    expect(result.isCompliant).toBe(true);
    expect(result.score).toBe(4);
  });
});
