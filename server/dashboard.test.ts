import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Helpers ────────────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

// ── Dashboard: SLA Stats ───────────────────────────────────────────────────
describe("dashboard.slaStats", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.slaStats({ period: "month" })).rejects.toThrow();
  });

  it("accepts period=month and returns sla fields", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.slaStats({ period: "month" });
    expect(result).toBeDefined();
    expect(typeof result.slaThis === "number" || result.slaThis === null).toBe(true);
    expect(typeof result.slaLast === "number" || result.slaLast === null).toBe(true);
    expect(typeof result.onTimeThis === "number").toBe(true);
    expect(typeof result.totalThis === "number").toBe(true);
  }, 15000);

  it("accepts period=quarter", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.slaStats({ period: "quarter" });
    expect(result).toBeDefined();
    expect(typeof result.onTimeThis === "number").toBe(true);
  }, 15000);

  it("accepts period=year", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.slaStats({ period: "year" });
    expect(result).toBeDefined();
    expect(typeof result.totalThis === "number").toBe(true);
  }, 15000);

  it("rejects invalid period value", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error testing invalid input
      caller.dashboard.slaStats({ period: "invalid" })
    ).rejects.toThrow();
  });
});

// ── Dashboard: Completed Tasks Summary ────────────────────────────────────
describe("dashboard.completedTasksSummary", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.completedTasksSummary()).rejects.toThrow();
  });

  it("returns an array with the requested report fields", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.completedTasksSummary({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    for (const task of result) {
      expect(typeof task.id).toBe("number");
      expect(typeof task.title).toBe("string");
      expect(typeof task.progress).toBe("number");
    }
  }, 15000);
});

// ── Dashboard: Upcoming Deadlines ─────────────────────────────────────────
describe("dashboard.upcomingDeadlines", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.upcomingDeadlines()).rejects.toThrow();
  });

  it("returns counts and tasks array", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.upcomingDeadlines();
    expect(result).toBeDefined();
    expect(result.counts).toBeDefined();
    expect(typeof result.counts.next7 === "number").toBe(true);
    expect(typeof result.counts.next15 === "number").toBe(true);
    expect(typeof result.counts.next30 === "number").toBe(true);
    expect(Array.isArray(result.tasks)).toBe(true);
  }, 15000);
});

// ── Dashboard: Check Deadline Alerts ──────────────────────────────────────
describe("dashboard.checkDeadlineAlerts", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.checkDeadlineAlerts()).rejects.toThrow();
  });

  it("returns alertsSent and tasksChecked as numbers", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.checkDeadlineAlerts();
    expect(result).toBeDefined();
    expect(typeof result.alertsSent === "number").toBe(true);
    expect(typeof result.tasksChecked === "number").toBe(true);
    // alertsSent can be 0 if no tasks are due in 3 days
    expect(result.alertsSent).toBeGreaterThanOrEqual(0);
    expect(result.tasksChecked).toBeGreaterThanOrEqual(0);
  }, 15000);
});
