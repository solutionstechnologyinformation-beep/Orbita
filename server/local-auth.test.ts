import { afterEach, describe, expect, it } from "vitest";
import { createScryptPasswordHash, isLocalAuthEnabled, slugifyCompanyName, verifyScryptPassword } from "./local-auth";
import { getSessionCookieOptions } from "./_core/cookies";

describe("local-auth", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.LOCAL_AUTH_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.LOCAL_AUTH_ENABLED;
    else process.env.LOCAL_AUTH_ENABLED = originalFlag;
  });

  it("cria e valida hashes scrypt sem armazenar a senha original", () => {
    const hash = createScryptPasswordHash("Senha-local-segura-123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Senha-local-segura-123");
    expect(verifyScryptPassword("Senha-local-segura-123", hash)).toBe(true);
    expect(verifyScryptPassword("senha-incorreta", hash)).toBe(false);
  });

  it("mantém o cadastro habilitado por padrão em desenvolvimento e desabilitado em produção", () => {
    delete process.env.LOCAL_AUTH_ENABLED;
    process.env.NODE_ENV = "development";
    expect(isLocalAuthEnabled()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(isLocalAuthEnabled()).toBe(false);
    process.env.LOCAL_AUTH_ENABLED = "true";
    expect(isLocalAuthEnabled()).toBe(true);
  });

  it("normaliza o slug da empresa para replicação por tenant", () => {
    expect(slugifyCompanyName("Órbita Engenharia & Projetos")).toBe("orbita-engenharia-projetos");
    expect(slugifyCompanyName("!!!")).toBe("empresa-orbita");
  });

  it("usa SameSite=Lax no localhost e SameSite=None em HTTPS", () => {
    const localOptions = getSessionCookieOptions({ protocol: "http", headers: {}, hostname: "localhost" } as any);
    const secureOptions = getSessionCookieOptions({ protocol: "https", headers: {}, hostname: "app.empresa.com.br" } as any);
    expect(localOptions.sameSite).toBe("lax");
    expect(localOptions.secure).toBe(false);
    expect(secureOptions.sameSite).toBe("none");
    expect(secureOptions.secure).toBe(true);
  });
});
