import { describe, expect, it, vi, beforeEach } from "vitest";
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

function makeAdminCtx(): TrpcContext {
  return makeCtx({
    user: {
      id: 99,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────

describe("auth", () => {
  it("me returns current user when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.email).toBe("test@example.com");
  });

  it("me returns null when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("logout clears session cookie", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

// ── Protected Procedures ───────────────────────────────────────────────────

describe("protected procedures", () => {
  it("dashboard.stats throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats()).rejects.toThrow();
  });

  it("projects.list throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.list()).rejects.toThrow();
  });

  it("notifications.list throws UNAUTHORIZED when not logged in", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.list()).rejects.toThrow();
  });
});

// ── Admin Procedures ───────────────────────────────────────────────────────

describe("admin procedures", () => {
  it("admin.users throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx(); // role: "user"
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("admin.allProjects throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.allProjects()).rejects.toThrow();
  });
});

// ── Input Validation ───────────────────────────────────────────────────────

describe("input validation", () => {
  it("projects.create rejects empty name", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.projects.create({ name: "", color: "#6366f1" })
    ).rejects.toThrow();
  });

  it("tasks.create rejects empty title", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tasks.create({ projectId: 1, title: "", status: "todo", priority: "medium" })
    ).rejects.toThrow();
  });

  it("tasks.addComment rejects empty content", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tasks.addComment({ taskId: 1, content: "" })
    ).rejects.toThrow();
  });

  it("notifications.markRead succeeds with any id (idempotent operation)", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    // markRead is idempotent - succeeds even if notification doesn't exist
    const result = await caller.notifications.markRead({ id: 999999 });
    expect(result.success).toBe(true);
  }, 15000);

  it("chat.send rejects empty message", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.send({ message: "" })
    ).rejects.toThrow();
  });
});

// ── Companies Multi-Tenant v3.9 ──────────────────────────────────────────
describe("companies multi-tenant", () => {
  it("allows authenticated users to list companies", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.companies.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("forbids non-admins from creating companies", async () => {
    const ctx = makeCtx({ user: { ...makeCtx().user!, role: "user" } });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.companies.create({ name: "Nova Empresa", slug: "nova-empresa", color: "#3b82f6" })
    ).rejects.toThrow();
  });
});
