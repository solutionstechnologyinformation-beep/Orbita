import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { assertCanDeleteUser } from "./admin-delete-policy";
import type { TrpcContext } from "./_core/context";

function makeCtx(role: "user" | "admin" = "admin"): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "admin-delete-test",
      email: "admin-delete@example.com",
      name: "Admin Delete Test",
      loginMethod: "local",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("admin.deleteUser", () => {
  it("exposes the admin namespace and rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.admin.deleteUser({ userId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects self-deletion", () => {
    expect(() => assertCanDeleteUser(99, 99, "admin")).toThrowError(TRPCError);
    expect(() => assertCanDeleteUser(99, 99, "admin")).toThrow("Você não pode remover sua própria conta.");
  });

  it("rejects deleting the master administrator", () => {
    expect(() => assertCanDeleteUser(99, 12, "master_admin")).toThrowError(TRPCError);
    expect(() => assertCanDeleteUser(99, 12, "master_admin")).toThrow("O administrador principal não pode ser removido.");
  });
});
