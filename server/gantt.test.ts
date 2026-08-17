import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("tasks.listForGantt", () => {
  it("protege os dados da timeline para usuários não autenticados", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.tasks.listForGantt({})).rejects.toThrow();
  });

  it("expõe a procedure com filtros opcionais para a timeline", () => {
    const caller = appRouter.createCaller(makeContext({
      id: 1,
      openId: "gantt-test-user",
      email: "gantt@example.com",
      name: "Gantt Test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    expect(caller.tasks.listForGantt).toBeTypeOf("function");
    expect(caller.tasks.updateDatesCascade).toBeTypeOf("function");
  });
});
