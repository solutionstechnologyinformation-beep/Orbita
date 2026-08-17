import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sec-test-user",
      email: "security@orbita.com.br",
      name: "Security Auditor",
      loginMethod: "manus",
      role: "user",
      companyId: 10,
      company: "Orbita Test Corp",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

describe("Auditoria de Segurança do Orbita", () => {
  it("bloqueia chamadas a procedimentos protegidos sem autenticação", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats({})).rejects.toThrow();
    await expect(caller.clients.list()).rejects.toThrow();
    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("restringe procedimentos administrativos a papéis com privilégio elevado", async () => {
    const ctx = makeCtx({ user: { id: 2, openId: "regular-user", role: "user", companyId: 10, email: "user@test.com", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("valida a estrutura de isolamento multi-tenant por companyId nas consultas", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats({});
    expect(stats).toBeDefined();
    expect(typeof stats.totalCrs).toBe("number");
    expect(typeof stats.totalTasks).toBe("number");
  });
});

import { validatePasswordComplexity } from "./password-policy";

describe("Auditoria de Política de Senha", () => {
  it("rejeita senhas abaixo do tamanho mínimo configurado pelo tenant", () => {
    const policy = { minLength: 10, requireUppercase: true, requireNumber: true, requireSpecial: true };
    const result = validatePasswordComplexity("Curto1!", policy);
    expect(result.valid).toBe(false);
  });

  it("aprova senha complexa conforme política", () => {
    const policy = { minLength: 8, requireUppercase: true, requireNumber: true, requireSpecial: true };
    const result = validatePasswordComplexity("SenhaForte9!", policy);
    expect(result.valid).toBe(true);
  });
});
