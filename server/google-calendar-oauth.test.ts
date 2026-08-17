import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: { host: "localhost:3000" } } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

describe("google calendar oauth readiness", () => {
  it("throws precondition failed when GOOGLE_CALENDAR_CLIENT_ID is missing", async () => {
    const originalClient = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;

    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.googleCalendar.getAuthUrl()).rejects.toThrow();

    process.env.GOOGLE_CALENDAR_CLIENT_ID = originalClient ?? "mock-client-id";
  });
});
