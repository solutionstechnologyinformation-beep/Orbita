import { describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD_POLICY, normalizePasswordPolicy, validatePassword } from "./password-policy";

describe("company-password-policy", () => {
  it("aplica defaults seguros para tenants novos", () => {
    expect(normalizePasswordPolicy(undefined)).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  it("mantém o tamanho dentro dos limites configuráveis", () => {
    expect(normalizePasswordPolicy({ minLength: 3 }).minLength).toBe(8);
    expect(normalizePasswordPolicy({ minLength: 200 }).minLength).toBe(128);
    expect(normalizePasswordPolicy({ minLength: 16 }).minLength).toBe(16);
  });

  it("valida somente os requisitos habilitados pelo tenant", () => {
    expect(validatePassword("senha-sem-numero", { minLength: 8, requireNumber: true }).valid).toBe(false);
    expect(validatePassword("senha-segura9", { minLength: 8, requireNumber: true }).valid).toBe(true);
    expect(validatePassword("senha-segura9", { minLength: 8, requireUppercase: true, requireNumber: true }).valid).toBe(false);
    expect(validatePassword("Senha-segura9", { minLength: 8, requireUppercase: true, requireNumber: true }).valid).toBe(true);
  });

  it("exige caractere especial quando a empresa habilita essa regra", () => {
    const result = validatePassword("Senhasegura9", { minLength: 8, requireUppercase: true, requireNumber: true, requireSpecial: true });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("A senha deve conter pelo menos um caractere especial.");
    expect(validatePassword("Senhasegura9!", { minLength: 8, requireUppercase: true, requireNumber: true, requireSpecial: true }).valid).toBe(true);
  });

  it("retorna todos os problemas de uma senha inválida", () => {
    const result = validatePassword("abc", { minLength: 12, requireUppercase: true, requireNumber: true, requireSpecial: true });
    expect(result.errors).toHaveLength(4);
  });
});
