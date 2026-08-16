import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { resolveTxt } from "node:dns/promises";
import { users } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { isBlockedPhaseName, normalizeBlockReason } from "../shared/kanban-block";
import { getKanbanStatusForPhase } from "../shared/kanban-status";
import {
  updateUser, upsertUser, getProjectMembers, deleteUser, getMemberPerformance,
  getClients, getAllClients, getClientById, createClient, updateClient, deleteClient,
  getCrsByClient, getAllCrs, getArchivedCrs, getCrsById, createCrs, updateCrs, deleteCrs,
  getPhasesByCrs, createPhase, updatePhase, deletePhase,
  getTasksByCrs, getTaskById, createTask, updateTask, deleteTask, recalcTaskProgress,
  getTaskComments, createTaskComment, deleteTaskComment,
  getChecklistItems, createChecklistItem, updateChecklistItem, deleteChecklistItem, getCrsDateRange,
  getChecklistItemComments, createChecklistItemComment,
  recordPhaseChange, getTaskPhaseHistory, getChecklistItemHistory,
  getVacationPeriods, createVacationPeriod, deleteVacationPeriod, isUserOnVacation,
  notifyUser, getNotifications, markNotificationRead, markAllNotificationsRead, getNotificationPreferences, updateNotificationTypePreference, getDeadlineAlertDays, updateDeadlineAlertDays,
  logActivity, getDisciplines, getDashboardStats, getDashboardContractDetails, getDashboardCompanies, getContractsByState, getWorldMapData, getWeekDeliveries, getMyTasks,
  getCompanies, getCompanyById, getCompanyAdminDashboard, updateCompanyMemberRole, archiveCompanyProject, createCompanyLocalUser, createCompany, updateCompany, updateCompanyBranding, deleteCompany, getChatActivityByDiscipline,
  getAgendaEvents, createAgendaEvent, deleteAgendaEvent,
  getChatMessages, createChatMessage, setChatTypingState, clearChatTypingState, getChatTypingUsers,
  getOrCreateConversation, getDirectMessages, sendDirectMessage, getUserConversations,
  createGroupConversation, getGroupConversations, getConversationMembers, markConversationAsRead, getTasksInVacationPeriod,
  getSprintsByCrs, getSprintChecklistItems, addChecklistItemToSprint, removeChecklistItemFromSprint,
  getSprintWithTasks, addTaskToSprint, removeTaskFromSprint,
  getClientProgress, getCrsDisciplineProgress, getYearlyStats, getCompletedTasksSummary,
  getWhiteboardsByUser, saveWhiteboard, deleteWhiteboard, renameWhiteboard,
  getUserDisciplines, setUserDisciplines, getActivityLogs, getTaskTrend,
  getAnnualReport,
  getContractsForPdf,
  getDb,
  getGoogleCalendarToken, saveGoogleCalendarToken, deleteGoogleCalendarToken,
  saveGoogleCalendarEvent, getGoogleCalendarEventsByUser, deleteGoogleCalendarEvent,
  getSubscriptionPlans, getSubscriptionPlanById, getUserSubscription, createUserSubscription,
  updateUserSubscription, cancelUserSubscription, getUserInvoices, hasActiveSubscription,
  getSubscriptionStatus, isTrialPeriod,
  getMeetings, getMeetingById, createMeeting, updateMeeting, deleteMeeting,
  getCrsSegments, createCrsSegment, deleteCrsSegment,
  getUserAiMemories, addUserAiMemory, deleteUserAiMemory,
} from "./db";
import { createGoogleCalendarEvent, createGoogleCalendarMeeting, syncGoogleCalendarEvents, syncGoogleMeetReport } from "./google-calendar";
import { buildSlaHistory, getSlaPeriodConfig, summarizeSlaEvents, type SlaHistoryEvent } from "./sla-history";
import { getSegmentContentType, sanitizeSegmentFileName, validateSegmentGeometry } from "./crs-segments";
import { getDeadlineAlertWindow, normalizeDeadlineAlertDays } from "../shared/deadline-alert";
import { summarizePdfAttachment } from "./pdf-summary";
import { getCompanyMigrationSnapshot, importCompanyMigrationJson } from "./migration-export";
import { processFloatingAgentCommand } from "./floating-agent";
import { generateTaskContextSuggestions } from "./task-ai-suggestions";
import { assertCanDeleteUser } from "./admin-delete-policy";
import { notifyOwner } from "./_core/notification";
import { createGoogleOAuthState } from "./_core/google-oauth-state";
import { invokeLLM } from "./_core/llm";
import stripe from "stripe";
import { generateAndSendEmailTfaCode, verifyEmailTfaCode, maskEmail } from "./tfa-service";
const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY || "");

// ─── Admin guard ───────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem realizar esta ação." });
  }
  return next({ ctx });
});

// ─── Leader guard (admin or leader) ───────────────────────────────────────────
const leaderProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "leader") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas líderes ou administradores podem realizar esta ação." });
  }
  return next({ ctx });
});

const companyAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "company_admin" && ctx.user.role !== "admin" && ctx.user.role !== "master_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores da empresa podem realizar esta ação." });
  }
  if (ctx.user.role === "company_admin" && ctx.user.companyId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O usuário administrador não está vinculado a uma empresa." });
  }
  return next({ ctx });
});

function normalizeCustomDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (domain.length < 3 || domain.length > 255 || domain.includes(" ") || domain === "localhost" || /^\d+(?:\.\d+){3}$/.test(domain)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Domínio inválido. Informe apenas um hostname público, sem protocolo ou caminho." });
  }
  if (!/^(?=.{1,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Domínio inválido. Use um hostname como app.empresa.com.br." });
  }
  return domain;
}

function canManageCompanyDomain(user: { role: string; companyId?: number | null }, companyId: number) {
  return user.role === "master_admin" || user.companyId === companyId;
}

function tenantCompanyId(user: { role: string; companyId?: number | null }) {
  return user.role === "master_admin" || user.role === "admin" ? user.companyId ?? undefined : user.companyId;
}

async function requireTenantCrs(user: { role: string; companyId?: number | null }, crsId: number) {
  const project = await getCrsById(crsId, tenantCompanyId(user));
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado no escopo da empresa." });
  return project;
}

async function deleteUserWithAdminGuards(actorId: number, targetUserId: number, companyId?: number | null) {
  const allUsers = await getProjectMembers(companyId);
  const targetUser = allUsers.find((u: any) => u.id === targetUserId);
  if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
  assertCanDeleteUser(actorId, targetUserId, targetUser.role);
  await deleteUser(targetUserId);
  await logActivity({ userId: actorId, action: "deleted_user", entityType: "user", entityId: targetUserId, metadata: JSON.stringify({ name: targetUser.name ?? targetUser.email }) });
  return { success: true };
}

export const appRouter = router({
  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return ctx.user;
    }),
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      const { COOKIE_NAME } = await import("../shared/const");
      const { getSessionCookieOptions } = await import("./_core/cookies");
      ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));
      return { success: true };
    }),
    projectMembers: protectedProcedure.query(async ({ ctx }) => getProjectMembers(tenantCompanyId(ctx.user))),
    updateProfile: protectedProcedure
      .input(z.object({ name: z.string().optional(), company: z.string().trim().max(256).optional(), avatarUrl: z.string().optional(), avatarColor: z.string().optional(), avatarInitials: z.string().max(3).optional() }))
      .mutation(async ({ ctx, input }) => {
        await updateUser(ctx.user.id, input);
        return { success: true };
      }),
    uploadAvatarPhoto: protectedProcedure
      .input(z.object({ base64: z.string(), mimeType: z.string(), fileName: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('./storage');
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.mimeType.split('/')[1] ?? 'jpg';
        const key = `avatars/${ctx.user.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateUser(ctx.user.id, { avatarUrl: url });
        return { url };
      }),
    updateUserAvatar: adminProcedure
      .input(z.object({ userId: z.number(), avatarColor: z.string().optional(), avatarInitials: z.string().max(3).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { userId, ...data } = input;
        const target = (await getProjectMembers(tenantCompanyId(ctx.user))).find((member: any) => member.id === userId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário fora do escopo da empresa." });
        await updateUser(userId, data);
        return { success: true };
      }),
  }),
  // ─── Presence ─────────────────────────────────────────────────────────────────────
  presence: router({
    heartbeat: protectedProcedure.mutation(async ({ ctx }) => {
      await updateUser(ctx.user.id, { lastSeenAt: new Date() });
      return { success: true, lastSeenAt: new Date() };
    }),
  }),
  // ─── Users ────────────────────────────────────────────────────────────────────────
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getProjectMembers(tenantCompanyId(ctx.user));
    }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "leader"]) }))
      .mutation(async ({ ctx, input }) => {
        const target = (await getProjectMembers(tenantCompanyId(ctx.user))).find((member: any) => member.id === input.userId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário fora do escopo da empresa." });
        await updateUser(input.userId, { role: input.role as any });
        return { success: true };
      }),
    createUser: adminProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(256),
        email: z.string().trim().email(),
        password: z.string().min(6).max(128),
        role: z.enum(["user", "admin", "leader"]).default("user"),
        company: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Já existe um usuário cadastrado com este e-mail." });
        }
        const { scryptSync, randomBytes } = await import("crypto");
        const salt = randomBytes(16).toString("hex");
        const derivedKey = scryptSync(input.password, salt, 64).toString("hex");
        const passwordHash = `scrypt$${salt}$${derivedKey}`;
        const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const initials = input.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

        const [result] = await db.execute(
          sql`INSERT INTO users (openId, name, email, loginMethod, role, company, companyId, passwordHash, avatarInitials, createdAt, updatedAt, lastSignedIn)
              VALUES (${openId}, ${input.name}, ${input.email}, 'local', ${input.role}, ${input.company ?? null}, ${ctx.user.companyId ?? null}, ${passwordHash}, ${initials}, NOW(), NOW(), NOW())`
        );
        const newUserId = (result as any).insertId as number;
        await logActivity({ userId: ctx.user.id, action: "created_user_local", entityType: "user", entityId: newUserId, metadata: JSON.stringify({ email: input.email, role: input.role }) });
        return { id: newUserId };
      }),
    // Disciplinas de responsabilidade do usuário
    getDisciplines: protectedProcedure
      .input(z.object({ userId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const uid = input.userId ?? ctx.user.id;
        return getUserDisciplines(uid);
      }),
    setDisciplines: adminProcedure
      .input(z.object({ userId: z.number(), disciplines: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        await setUserDisciplines(input.userId, input.disciplines);
        return { success: true };
      }),
    setMyDisciplines: protectedProcedure
      .input(z.object({ disciplines: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        await setUserDisciplines(ctx.user.id, input.disciplines);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => deleteUserWithAdminGuards(ctx.user.id, input.userId, tenantCompanyId(ctx.user))),
    memberPerformance: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }))
      .query(async ({ input }) => {
        return getMemberPerformance(input.crsId);
      }),
  }),
  admin: router({
    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => deleteUserWithAdminGuards(ctx.user.id, input.userId, tenantCompanyId(ctx.user))),
  }),
  companyAdmin: router({
    dashboard: companyAdminProcedure.query(async ({ ctx }) => {
      const companyId = ctx.user.companyId;
      if (companyId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Empresa não definida." });
      const data = await getCompanyAdminDashboard(companyId);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
      return data;
    }),
    createUser: companyAdminProcedure
      .input(z.object({ name: z.string().trim().min(1).max(256), email: z.string().trim().email(), password: z.string().min(6).max(128), role: z.enum(["user", "leader", "company_admin"]).default("user") }))
      .mutation(async ({ ctx, input }) => {
        const companyId = ctx.user.companyId;
        if (companyId == null) throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Já existe um usuário cadastrado com este e-mail." });
        const { scryptSync, randomBytes } = await import("crypto");
        const salt = randomBytes(16).toString("hex");
        const passwordHash = `scrypt$${salt}$${scryptSync(input.password, salt, 64).toString("hex")}`;
        const id = await createCompanyLocalUser({ companyId, name: input.name, email: input.email, passwordHash, role: input.role, companyName: ctx.user.company ?? undefined });
        await logActivity({ userId: ctx.user.id, action: "created_company_user", entityType: "user", entityId: id, metadata: JSON.stringify({ email: input.email, role: input.role }) });
        return { id };
      }),
    updateUserRole: companyAdminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "leader", "company_admin"]) }))
      .mutation(async ({ ctx, input }) => {
        const companyId = ctx.user.companyId;
        if (companyId == null) throw new TRPCError({ code: "FORBIDDEN" });
        if (input.userId === ctx.user.id && input.role !== "company_admin") throw new TRPCError({ code: "BAD_REQUEST", message: "O administrador atual precisa permanecer administrador da empresa." });
        await updateCompanyMemberRole(companyId, input.userId, input.role);
        return { success: true };
      }),
    archiveProject: companyAdminProcedure
      .input(z.object({ crsId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const companyId = ctx.user.companyId;
        if (companyId == null) throw new TRPCError({ code: "FORBIDDEN" });
        await archiveCompanyProject(companyId, input.crsId);
        return { success: true };
      }),
    updateBranding: companyAdminProcedure
      .input(z.object({ name: z.string().trim().min(1).max(256), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), logoUrl: z.string().optional().nullable(), logoDarkUrl: z.string().optional().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const companyId = ctx.user.companyId;
        if (companyId == null) throw new TRPCError({ code: "FORBIDDEN" });
        await updateCompanyBranding(companyId, input);
        await logActivity({ userId: ctx.user.id, action: "updated_company_branding", entityType: "company", entityId: companyId, metadata: JSON.stringify({ name: input.name }) });
        return { success: true };
      }),
    uploadLogo: companyAdminProcedure
      .input(z.object({ base64: z.string(), mimeType: z.string(), fileName: z.string(), variant: z.enum(["light", "dark"]) }))
      .mutation(async ({ ctx, input }) => {
        const companyId = ctx.user.companyId;
        if (companyId == null) throw new TRPCError({ code: "FORBIDDEN" });
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1] ?? "png";
        const key = `company-logos/${companyId}-${input.variant}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        const updatePayload = input.variant === "dark" ? { logoDarkUrl: url } : { logoUrl: url };
        await updateCompanyBranding(companyId, updatePayload);
        return { url };
      }),
  }),
  companies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const companyId = tenantCompanyId(ctx.user);
      if (companyId != null) {
        const company = await getCompanyById(companyId);
        return company ? [company] : [];
      }
      return getCompanies();
    }),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), slug: z.string().min(1), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await createCompany(input);
        await logActivity({ userId: ctx.user.id, action: "created_company", entityType: "company", entityId: id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), slug: z.string().optional(), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateCompany(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCompany(input.id);
        return { success: true };
      }),
  }),
  // ─── Registros (Activity Logs) ───────────────────────────────────────────────────────────
  registros: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional(), userId: z.number().optional(), entityType: z.string().optional() }))
      .query(async ({ input }) => {
        return getActivityLogs({ limit: input.limit ?? 200, userId: input.userId, entityType: input.entityType });
      }),
  }),

  // ─── Clients ───────────────────────────────────────────────────────────────
  clients: router({
    list: protectedProcedure.query(async () => getClients()),
    listAll: adminProcedure.query(async () => getAllClients()),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const c = await getClientById(input.id);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      return c;
    }),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional(), crsCode: z.string().optional(), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await createClient({ ...input, createdById: ctx.user.id });
        await logActivity({ userId: ctx.user.id, action: "created_client", entityType: "client", entityId: id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), crsCode: z.string().nullable().optional(), color: z.string().optional(), status: z.enum(["active", "archived"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateClient(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteClient(input.id);
        return { success: true };
      }),
  }),

  // ─── CRS ───────────────────────────────────────────────────────────────────
  crs: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), company: z.string().trim().max(256).optional() }).optional())
      .query(async ({ ctx, input }) => getAllCrs(input?.company, input?.clientId, tenantCompanyId(ctx.user))),
    listByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => getCrsByClient(input.clientId, tenantCompanyId(ctx.user))),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const c = await getCrsById(input.id, tenantCompanyId(ctx.user));
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        const dateRange = await getCrsDateRange(input.id);
        return { ...c, derivedStartDate: dateRange.startDate, derivedEndDate: dateRange.endDate };
      }),
    create: adminProcedure
      .input(z.object({
        clientId: z.number(),
        name: z.string().min(1),
        code: z.string().optional(),
        description: z.string().optional(),
        country: z.string().optional(),
        countryCode: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        tipoObra: z.array(z.enum(["implementacao", "restauracao", "aumento_capacidade", "levantamento", "outro"])).optional(),
        extensaoKm: z.number().optional(),
        areaHa: z.number().optional(),
        perimetroUrbano: z.number().int().optional(),
        techDataByType: z.record(z.string(), z.object({ extensaoKm: z.number().nullable().optional(), areaHa: z.number().nullable().optional() })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const techDataByTypeStr = input.techDataByType ? JSON.stringify(input.techDataByType) : undefined;
        const id = await createCrs({ ...input, companyId: ctx.user.companyId, tipoObra: input.tipoObra ? JSON.stringify(input.tipoObra) : undefined, techDataByType: techDataByTypeStr, createdById: ctx.user.id });
        await logActivity({ userId: ctx.user.id, action: "created_crs", entityType: "crs", entityId: id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        clientId: z.number().optional(),
        name: z.string().optional(),
        code: z.string().optional(),
        description: z.string().optional(),
        country: z.string().optional(),
        countryCode: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        status: z.enum(["active", "archived"]).optional(),
        tipoObra: z.array(z.enum(["implementacao", "restauracao", "aumento_capacidade", "levantamento", "outro"])).nullable().optional(),
        extensaoKm: z.number().nullable().optional(),
        areaHa: z.number().nullable().optional(),
        perimetroUrbano: z.number().int().nullable().optional(),
        techDataByType: z.record(z.string(), z.object({ extensaoKm: z.number().nullable().optional(), areaHa: z.number().nullable().optional() })).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await requireTenantCrs(ctx.user, id);
        const techDataByTypeStr = data.techDataByType != null ? JSON.stringify(data.techDataByType) : data.techDataByType;
        await updateCrs(id, { ...data, tipoObra: data.tipoObra != null ? JSON.stringify(data.tipoObra) : data.tipoObra, techDataByType: techDataByTypeStr });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireTenantCrs(ctx.user, input.id);
        await deleteCrs(input.id);
        return { success: true };
      }),
    listArchived: protectedProcedure.query(async ({ ctx }) => getArchivedCrs(tenantCompanyId(ctx.user))),
    archive: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireTenantCrs(ctx.user, input.id);
        await updateCrs(input.id, { status: "archived" });
        return { success: true };
      }),
    restore: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireTenantCrs(ctx.user, input.id);
        await updateCrs(input.id, { status: "active" });
        return { success: true };
      }),
    worldMap: protectedProcedure.query(async () => getWorldMapData()),
    segments: router({
      list: protectedProcedure
        .input(z.object({ crsId: z.number().optional(), clientId: z.number().optional(), company: z.string().trim().max(256).optional() }).optional())
        .query(async ({ ctx, input }) => getCrsSegments(input?.crsId, input?.company, input?.clientId, tenantCompanyId(ctx.user))),
      upload: adminProcedure
        .input(z.object({
          crsId: z.number(),
          name: z.string().trim().min(1).max(256),
          fileName: z.string().trim().min(1).max(256),
          mimeType: z.string().max(128),
          base64: z.string().min(1),
          geometryJson: z.string().min(2).max(2_000_000),
          boundsJson: z.string().max(10_000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await requireTenantCrs(ctx.user, input.crsId);
          const extension = input.fileName.toLowerCase().split(".").pop();
          if (extension !== "kmz" && extension !== "kml") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Envie um arquivo .KMZ ou .KML." });
          }
          const buffer = Buffer.from(input.base64, "base64");
          if (buffer.length > 15 * 1024 * 1024) {
            throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O arquivo deve ter no máximo 15 MB." });
          }
          let geometry: ReturnType<typeof validateSegmentGeometry>;
          try {
            geometry = validateSegmentGeometry(input.geometryJson);
          } catch {
            throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo não contém geometria geográfica válida." });
          }
          const safeName = sanitizeSegmentFileName(input.fileName);
          const { storagePut } = await import("./storage");
          const contentType = getSegmentContentType(input.fileName);
          const { url } = await storagePut(`crs-segments/${input.crsId}/${ctx.user.id}-${Date.now()}-${safeName}`, buffer, contentType);
          const id = await createCrsSegment({
            crsId: input.crsId,
            name: input.name,
            fileName: input.fileName,
            fileUrl: url,
            geometryJson: JSON.stringify(geometry),
            boundsJson: input.boundsJson,
            createdById: ctx.user.id,
          });
          return { id, url };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number(), crsId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await requireTenantCrs(ctx.user, input.crsId);
          await deleteCrsSegment(input.id, input.crsId);
          return { success: true };
        }),
    }),
    createInvite: adminProcedure
      .input(z.object({
        crsId: z.number(),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
        origin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { sql: sqlExpr } = await import("drizzle-orm");
        const crypto = await import("crypto");
        const token = crypto.randomBytes(24).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.execute(
          sqlExpr`INSERT INTO project_invites (crsId, token, role, createdById, expiresAt, createdAt)
          VALUES (${input.crsId}, ${token}, ${input.role}, ${ctx.user.id}, ${expiresAt}, NOW())
          ON DUPLICATE KEY UPDATE token = ${token}, expiresAt = ${expiresAt}`
        );
        return { token, link: `${input.origin}/join?token=${token}` };
      }),
  }),
  // ─── Kanban Phases ─────────────────────────────────────────────────────────
  kanbanPhases: router({
    list: protectedProcedure
      .input(z.object({ crsId: z.number() }))
      .query(async ({ ctx, input }) => getPhasesByCrs(input.crsId, tenantCompanyId(ctx.user))),
    create: adminProcedure
      .input(z.object({ crsId: z.number(), name: z.string().min(1), color: z.string().optional(), position: z.number().optional(), isTerminal: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await createPhase({ ...input, createdById: ctx.user.id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), color: z.string().optional(), position: z.number().optional(), isTerminal: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePhase(id, data);
        return { success: true };
      }),
    reorder: adminProcedure
      .input(z.object({ phases: z.array(z.object({ id: z.number(), position: z.number() })) }))
      .mutation(async ({ input }) => {
        for (const p of input.phases) {
          await updatePhase(p.id, { position: p.position });
        }
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePhase(input.id);
        return { success: true };
      }),
  }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  tasks: router({
    summarizePdfAttachment: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive(), attachmentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId, tenantCompanyId(ctx.user));
        const attachment = (task as any)?.attachments?.find((item: any) => item.id === input.attachmentId);
        if (!attachment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Anexo não encontrado para esta tarefa." });
        }
        const isPdf = attachment.mimeType?.toLowerCase() === "application/pdf" || /\.pdf(?:$|\?)/i.test(attachment.filename ?? "");
        if (!isPdf) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O resumo automático está disponível apenas para arquivos PDF." });
        }
        return await summarizePdfAttachment(attachment.fileUrl);
      }),
    contextSuggestions: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        return { suggestions: await generateTaskContextSuggestions(input.taskId) };
      }),
    listForGantt: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        crsId: z.number().optional(),
        setor: z.string().optional(),
        assigneeId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { tasks: t, crs: c, users: u, kanbanPhases: kp, clients: cl } = await import('../drizzle/schema');
        const { eq: eq2, and: and2, like: like2 } = await import('drizzle-orm');
        const db = await getDb();
        const conditions: any[] = [];
        if (input.crsId) conditions.push(eq2(t.crsId, input.crsId));
        if (input.assigneeId) conditions.push(eq2(t.assigneeId, input.assigneeId));
        if (input.setor) conditions.push(eq2(t.setor, input.setor));
        const companyId = tenantCompanyId(ctx.user);
        if (companyId != null) conditions.push(eq2(c.companyId, companyId));
        const rows = await db.select({
          id: t.id, crsId: t.crsId, phaseId: t.phaseId,
          title: t.title, priority: t.priority,
          assigneeId: t.assigneeId, dueDate: t.dueDate,
          startDate: t.startDate, endDate: t.endDate,
          setor: t.setor, progress: t.progress,
          assigneeName: u.name,
          assigneeCompany: u.company,
          projectName: c.name,
          clientId: c.clientId,
          phaseName: kp.name, phaseColor: kp.color, phaseIsTerminal: kp.isTerminal,
          clientName: cl.name,
        }).from(t)
          .leftJoin(u, eq2(t.assigneeId, u.id))
          .leftJoin(c, eq2(t.crsId, c.id))
          .leftJoin(kp, eq2(t.phaseId, kp.id))
          .leftJoin(cl, eq2(c.clientId, cl.id))
          .where(conditions.length > 0 ? and2(...conditions) : undefined)
          .orderBy(t.setor, u.name, t.startDate);
        // filter by clientId after join
        const filtered = input.clientId ? rows.filter((r: any) => r.clientId === input.clientId) : rows;
        // Enrich with checklist items
        const enriched = await Promise.all(
          filtered.map(async (task: any) => {
            const items = await getChecklistItems(task.id);
            return { ...task, checklistItems: items };
          })
        );
        return enriched;
      }),
    listByCrs: protectedProcedure
      .input(z.object({
        crsId: z.number(),
        phaseId: z.number().optional(),
        priority: z.string().optional(),
        assigneeId: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { crsId, ...filters } = input;
        return getTasksByCrs(crsId, filters, tenantCompanyId(ctx.user));
      }),
    listByCrsWithChecklist: protectedProcedure
      .input(z.object({ crsId: z.number() }))
      .query(async ({ ctx, input }) => {
        const taskList = await getTasksByCrs(input.crsId, undefined, tenantCompanyId(ctx.user));
        const enriched = await Promise.all(
          taskList.map(async (t: (typeof taskList)[number]) => {
            const checklistItems = await getChecklistItems(t.id);
            return { ...t, checklistItems };
          })
        );
        return enriched;
      }),
    listBlocked: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const companyId = tenantCompanyId(ctx.user);
      const companyFilter = companyId != null ? `AND c.companyId = ${Number(companyId)}` : "";
      const [rows] = await (db as any).$client.query(`
        SELECT t.id, t.title, t.priority, t.blockReason, t.statusChangedAt,
          t.dueDate, t.crsId, t.assigneeId, u.name as assigneeName, u.company as assigneeCompany, c.name as projectName
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigneeId
        LEFT JOIN crs c ON c.id = t.crsId
        WHERE t.status = 'blocked' ${companyFilter}
        ORDER BY t.statusChangedAt DESC
      `);
      return rows as any[];
    }),
    listWithCounts: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const companyId = tenantCompanyId(ctx.user);
      const allCrs = await getAllCrs(undefined, undefined, companyId);
      // Use kanban phase terminal flag to determine completion (not legacy status field)
      const [countRows] = await (db as any).$client.query(`
        SELECT t.crsId,
          COUNT(t.id) as total,
          SUM(CASE WHEN kp.isTerminal = 1 THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN kp.isTerminal = 0 OR kp.isTerminal IS NULL THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
          SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN t.status = 'shared' THEN 1 ELSE 0 END) as shared
        FROM tasks t
        LEFT JOIN kanban_phases kp ON kp.id = t.phaseId
        LEFT JOIN crs c ON c.id = t.crsId
        ${companyId != null ? `WHERE c.companyId = ${Number(companyId)}` : ""}
        GROUP BY t.crsId
      `);
      const countMap = Object.fromEntries((countRows as any[]).map((r: any) => [r.crsId, {
        total: Number(r.total), published: Number(r.published),
        inProgress: Number(r.inProgress), blocked: Number(r.blocked),
        pending: Number(r.pending), shared: Number(r.shared),
      }]));
      return allCrs.map((c: any) => ({ ...c, taskCounts: countMap[c.id] ?? { total: 0, published: 0, inProgress: 0, blocked: 0, pending: 0, shared: 0 } }));
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await getTaskById(input.id, tenantCompanyId(ctx.user));
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        const comments = await getTaskComments(input.id);
        const checklist = await getChecklistItems(input.id);
        const phaseHistory = await getTaskPhaseHistory(input.id);
        const checklistHistory = await getChecklistItemHistory(input.id);
        return { ...task, comments, checklist, phaseHistory, checklistHistory };
      }),
    create: adminProcedure
      .input(z.object({
        crsId: z.number(),
        phaseId: z.number(),
        title: z.string().min(1).max(512),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assigneeId: z.number().optional(),
        dueDate: z.date().optional(),
        setor: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if assignee is on vacation
        if (input.assigneeId && input.dueDate) {
          const onVacation = await isUserOnVacation(input.assigneeId, input.dueDate);
          if (onVacation) {
            await notifyUser({
              userId: input.assigneeId,
              title: "Conflito de Férias",
              message: `A tarefa "${input.title}" foi atribuída a você durante um período de férias.`,
              notificationType: "vacation_conflict",
            });
          }
        }
        const id = await createTask({ ...input, createdById: ctx.user.id, position: Date.now() % 2000000000 });
        if (input.assigneeId && input.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: input.assigneeId,
            title: "Nova tarefa atribuída a você",
            message: `A tarefa "${input.title}" foi atribuída a você.`,
            notificationType: "task_assigned",
            relatedTaskId: id,
          });
        }
        await logActivity({ userId: ctx.user.id, action: "created_task", entityType: "task", entityId: id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        phaseId: z.number().optional(),
        crsId: z.number().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assigneeId: z.number().nullable().optional(),
        dueDate: z.date().nullable().optional(),
        startDate: z.date().nullable().optional(),
        endDate: z.date().nullable().optional(),
        position: z.number().optional(),
        setor: z.string().nullable().optional(),
        blockReason: z.string().nullable().optional(),
        status: z.enum(["pending", "in_progress", "shared", "published", "archived", "blocked"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const task = await getTaskById(id, tenantCompanyId(ctx.user));
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        // Record phase change history
        if (data.phaseId !== undefined && data.phaseId !== task.phaseId) {
          const { kanbanPhases } = await import("../drizzle/schema");
          const { eq: eq2 } = await import("drizzle-orm");
          const dbConn = await getDb();
          const [fromPhase] = await dbConn.select({ name: kanbanPhases.name }).from(kanbanPhases).where(eq2(kanbanPhases.id, task.phaseId)).limit(1);
          const [toPhase] = await dbConn.select({ name: kanbanPhases.name }).from(kanbanPhases).where(eq2(kanbanPhases.id, data.phaseId)).limit(1);
          await recordPhaseChange({
            taskId: id,
            changedById: ctx.user.id,
            fromPhaseId: task.phaseId,
            fromPhaseName: fromPhase?.name,
            toPhaseId: data.phaseId,
            toPhaseName: toPhase?.name ?? "Desconhecida",
          });
        }
        // Notify new assignee if changed
        if (data.assigneeId !== undefined && data.assigneeId !== null && data.assigneeId !== task.assigneeId && data.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: data.assigneeId,
            title: "Tarefa reatribuída a você",
            message: `A tarefa "${task.title}" foi atribuída a você.`,
            notificationType: "task_assigned",
            relatedTaskId: id,
          });
        }
        // Notify assignee if dueDate is set and already overdue
        if (data.dueDate && task.assigneeId && new Date(data.dueDate) < new Date()) {
          await notifyUser({
            userId: task.assigneeId,
            title: "Tarefa com prazo vencido",
            message: `A tarefa "${task.title}" tem prazo vencido.`,
            notificationType: "task_overdue",
            relatedTaskId: id,
          });
        }
        // Notify assignee and owner when task is blocked
        if (data.status === "blocked" && (task as any).status !== "blocked") {
          const blockerName = ctx.user.name ?? ctx.user.email ?? "Alguém";
          const reason = data.blockReason ? ` Motivo: ${data.blockReason}` : "";
          if (task.assigneeId && task.assigneeId !== ctx.user.id) {
            await notifyUser({
              userId: task.assigneeId,
              title: `Tarefa bloqueada: "${task.title}"`,
              message: `${blockerName} marcou esta tarefa como bloqueada.${reason}`,
              notificationType: "task_blocked",
              relatedTaskId: id,
            });
          }
          // Also notify owner
          await notifyOwner({
            title: `Tarefa bloqueada: "${task.title}"`,
            content: `${blockerName} bloqueou a tarefa "${task.title}".${reason}`,
          });
        }
        await updateTask(id, data);
        return { success: true };
      }),
    movePhase: protectedProcedure
      .input(z.object({ id: z.number(), phaseId: z.number(), position: z.number().optional(), blockReason: z.string().trim().min(1).optional() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.id, tenantCompanyId(ctx.user));
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        let targetPhaseName = "";
        if (input.phaseId !== task.phaseId) {
          const { kanbanPhases } = await import("../drizzle/schema");
          const { eq: eq2 } = await import("drizzle-orm");
          const dbConn = await getDb();
          const [fromPhase] = await dbConn.select({ name: kanbanPhases.name }).from(kanbanPhases).where(eq2(kanbanPhases.id, task.phaseId)).limit(1);
          const [toPhase] = await dbConn.select({ name: kanbanPhases.name }).from(kanbanPhases).where(eq2(kanbanPhases.id, input.phaseId)).limit(1);
          targetPhaseName = toPhase?.name ?? "Desconhecida";
          await recordPhaseChange({
            taskId: input.id, changedById: ctx.user.id,
            fromPhaseId: task.phaseId, fromPhaseName: fromPhase?.name,
            toPhaseId: input.phaseId, toPhaseName: targetPhaseName,
          });
        }
        const isBlockedPhase = isBlockedPhaseName(targetPhaseName);
        const nextStatus = getKanbanStatusForPhase(targetPhaseName, task.status as Parameters<typeof getKanbanStatusForPhase>[1]);
        await updateTask(input.id, {
          phaseId: input.phaseId,
          position: input.position ?? task.position,
          status: isBlockedPhase ? "blocked" : nextStatus,
          blockReason: isBlockedPhase ? normalizeBlockReason(input.blockReason) : null,
        });
        if (isBlockedPhase && input.blockReason && task.assigneeId && task.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: task.assigneeId,
            title: `Tarefa bloqueada: "${task.title}"`,
            message: `${ctx.user.name ?? "Um usuário"} informou: ${input.blockReason}`,
            notificationType: "task_blocked",
            relatedTaskId: task.id,
          });
        }
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTask(input.id);
        await logActivity({ userId: ctx.user.id, action: "deleted_task", entityType: "task", entityId: input.id });
        return { success: true };
      }),
    addComment: protectedProcedure
      .input(z.object({ taskId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const id = await createTaskComment({ taskId: input.taskId, userId: ctx.user.id, content: input.content });
        // Detect @mentions in comment content (e.g., @Nome)
        try {
          const task = await getTaskById(input.taskId, tenantCompanyId(ctx.user));
          const commenterName = ctx.user.name ?? ctx.user.email ?? "Alguém";
          // Notify task assignee about new comment (if not the commenter)
          if (task?.assigneeId && task.assigneeId !== ctx.user.id) {
            await notifyUser({
              userId: task.assigneeId,
              title: `Novo comentário em "${task.title}"`,
              message: `${commenterName}: ${input.content.slice(0, 80)}${input.content.length > 80 ? "..." : ""}`,
              notificationType: "task_comment",
              relatedTaskId: input.taskId,
            });
          }
          // Detect @mentions: find @word patterns and match to user names
          const mentions = input.content.match(/@(\w+)/g);
          if (mentions && mentions.length > 0) {
            const allUsers = await getProjectMembers(tenantCompanyId(ctx.user));
            for (const mention of mentions) {
              const mentionName = mention.slice(1).toLowerCase();
              const mentionedUser = allUsers.find((u: any) =>
                (u.name ?? "").toLowerCase().replace(/\s+/g, "").includes(mentionName) ||
                (u.email ?? "").toLowerCase().split("@")[0].includes(mentionName)
              );
              if (mentionedUser && mentionedUser.id !== ctx.user.id) {
                await notifyUser({
                  userId: mentionedUser.id,
                  title: `${commenterName} mencionou você`,
                  message: `Em "${task?.title ?? "tarefa"}": ${input.content.slice(0, 80)}`,
                  notificationType: "mention",
                  relatedTaskId: input.taskId,
                });
              }
            }
          }
        } catch {}
        return { id };
      }),
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTaskComment(input.id);
        return { success: true };
      }),
    duplicate: protectedProcedure
      .input(z.object({ id: z.number(), targetCrsId: z.number().optional(), targetPhaseId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const sourceTask = await getTaskById(input.id, tenantCompanyId(ctx.user));
        if (!sourceTask) throw new TRPCError({ code: "NOT_FOUND" });
        
        // Create new task with same properties
        const newTaskId = await createTask({
          crsId: input.targetCrsId || sourceTask.crsId,
          phaseId: input.targetPhaseId || sourceTask.phaseId,
          title: `${sourceTask.title} (cópia)`,
          description: sourceTask.description,
          priority: sourceTask.priority,
          assigneeId: sourceTask.assigneeId,
          dueDate: sourceTask.dueDate,
          setor: sourceTask.setor,
          createdById: ctx.user.id,
        });
        
        // Copy all checklist items
        const sourceItems = await getChecklistItems(input.id);
        for (const item of sourceItems) {
          await createChecklistItem({
            taskId: newTaskId,
            title: item.title,
            startDate: item.startDate,
            endDate: item.endDate,
            assigneeId: item.assigneeId,
            position: item.position,
            createdById: ctx.user.id,
          });
        }
        
        await logActivity({ userId: ctx.user.id, action: "duplicated_task", entityType: "task", entityId: input.id });
        return { id: newTaskId };
      }),
  }),

  // ─── Checklist Items ────────────────────────────────────────────────────────
  checklist: router({
    list: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => getChecklistItems(input.taskId)),
    create: adminProcedure
      .input(z.object({
        taskId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        assigneeId: z.number().optional(),
        position: z.number().optional(),
        startDate: z.string().optional(),  // ISO date string
        endDate: z.string().optional(),    // ISO date string
      }))
      .mutation(async ({ ctx, input }) => {
        const startDate = input.startDate ? new Date(input.startDate) : null;
        const endDate = input.endDate ? new Date(input.endDate) : null;
        const id = await createChecklistItem({ ...input, startDate, endDate, createdById: ctx.user.id });
        await recalcTaskProgress(input.taskId);
        return { id };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        assigneeId: z.number().nullable().optional(),
        position: z.number().optional(),
        startDate: z.string().nullable().optional(),  // ISO date string
        endDate: z.string().nullable().optional(),    // ISO date string
      }))
      .mutation(async ({ input }) => {
        const { id, startDate, endDate, ...rest } = input;
        const data: any = { ...rest };
        if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
        await updateChecklistItem(id, data);
        return { success: true };
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "in_progress", "shared", "published", "archived", "blocked"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { checklistItems: ci } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const [item] = await db.select().from(ci).where(eq2(ci.id, input.id)).limit(1);
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });
        // Permission check: user can only update items assigned to them (unless admin/leader)
        if (ctx.user.role === "user" && item.assigneeId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode alterar o status de itens atribuídos a você." });
        }
        const completedAt = (input.status === "published" || input.status === "archived") ? new Date() : null;
        await updateChecklistItem(input.id, { status: input.status, completedAt });
        // Record history
        await db.execute(
          (await import("drizzle-orm")).sql`INSERT INTO checklist_item_history (checklistItemId, taskId, changedById, fromStatus, toStatus, changedAt)
          VALUES (${input.id}, ${item.taskId}, ${ctx.user.id}, ${item.status}, ${input.status}, NOW())`
        );
        // Recalc task progress
        await recalcTaskProgress(item.taskId);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { checklistItems: ci } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const [item] = await db.select({ taskId: ci.taskId, title: ci.title }).from(ci).where(eq2(ci.id, input.id)).limit(1);
        await deleteChecklistItem(input.id);
        if (item) {
          await recalcTaskProgress(item.taskId);
          await logActivity({
            userId: ctx.user.id,
            action: "deleted_checklist_item",
            entityType: "checklist",
            entityId: item.taskId,
            metadata: JSON.stringify({ itemTitle: item.title, reason: input.reason ?? "Não informado" }),
          });
        }
        return { success: true };
      }),
    addComment: protectedProcedure
      .input(z.object({ checklistItemId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const id = await createChecklistItemComment({ ...input, userId: ctx.user.id });
        return { id };
      }),
    getComments: protectedProcedure
      .input(z.object({ checklistItemId: z.number() }))
      .query(async ({ input }) => getChecklistItemComments(input.checklistItemId)),
  }),

  // ─── Vacation Periods ───────────────────────────────────────────────────────
  vacations: router({
    list: protectedProcedure
      .input(z.object({ userId: z.number().optional() }))
      .query(async ({ input }) => getVacationPeriods(input.userId)),
    create: protectedProcedure
      .input(z.object({ userId: z.number(), startDate: z.date(), endDate: z.date(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Only admin can create for others
        if (input.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "master_admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Check for tasks conflicting with this vacation period
        const conflictingTasks = await getTasksInVacationPeriod(input.userId, input.startDate, input.endDate);
        const id = await createVacationPeriod(input);
        // Notify if there are conflicting tasks
        if (conflictingTasks.length > 0) {
          const taskTitles = conflictingTasks.slice(0, 3).map((t: any) => t.title).join(", ");
          const more = conflictingTasks.length > 3 ? ` e mais ${conflictingTasks.length - 3}` : "";
          await notifyUser({
            userId: input.userId,
            title: "Conflito de Férias com Atividades",
            message: `O período de férias conflita com ${conflictingTasks.length} tarefa(s): ${taskTitles}${more}. Remaneje as atividades antes de confirmar.`,
            notificationType: "vacation_conflict",
          });
          // Also notify admin if creating for another user
          if (input.userId !== ctx.user.id) {
            await notifyUser({
              userId: ctx.user.id,
              title: "Conflito de Férias Detectado",
              message: `As férias cadastradas conflitam com ${conflictingTasks.length} tarefa(s) de ${taskTitles}${more}.`,
              notificationType: "vacation_conflict",
            });
          }
        }
        return { id, conflictingTasksCount: conflictingTasks.length, conflictingTasks };
      }),
    checkConflictsForPeriod: protectedProcedure
      .input(z.object({ userId: z.number(), startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        const tasks = await getTasksInVacationPeriod(input.userId, input.startDate, input.endDate);
        return { conflictingTasks: tasks, hasConflicts: tasks.length > 0 };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteVacationPeriod(input.id);
        return { success: true };
      }),
    checkConflict: protectedProcedure
      .input(z.object({ userId: z.number(), date: z.date() }))
      .query(async ({ input }) => {
        const onVacation = await isUserOnVacation(input.userId, input.date);
        return { onVacation };
      }),
  }),

  // ─── CRS Discipline Progress ─────────────────────────────────────────────────────────
  crs_discipline: router({
    progress: protectedProcedure
      .input(z.object({ crsId: z.number() }))
      .query(async ({ ctx, input }) => getCrsDisciplineProgress(input.crsId, tenantCompanyId(ctx.user))),
  }),
  // ─── Dashboard ────────────────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), company: z.string().trim().max(256).optional() }))
      .query(async ({ ctx, input }) => getDashboardStats(input.clientId, input.company, tenantCompanyId(ctx.user))),
    contractDetails: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), company: z.string().trim().max(256).optional() }))
      .query(async ({ ctx, input }) => getDashboardContractDetails(input.clientId, input.company, tenantCompanyId(ctx.user))),
    worldMap: protectedProcedure.query(async ({ ctx }) => getWorldMapData(tenantCompanyId(ctx.user))),
    weekDeliveries: protectedProcedure.query(async ({ ctx }) => getWeekDeliveries(tenantCompanyId(ctx.user))),
    myTasks: protectedProcedure.query(async ({ ctx }) => getMyTasks(ctx.user.id)),
    completedTasksSummary: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
      .query(async ({ input }) => getCompletedTasksSummary(input?.limit ?? 100)),
    companies: protectedProcedure.query(async ({ ctx }) => getDashboardCompanies(tenantCompanyId(ctx.user))),
    chatActivityByDiscipline: protectedProcedure.query(async ({ ctx }) => getChatActivityByDiscipline(tenantCompanyId(ctx.user))),
    clientProgress: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), company: z.string().trim().max(256).optional() }).optional())
      .query(async ({ ctx, input }) => getClientProgress(input?.company, input?.clientId, tenantCompanyId(ctx.user))),
    yearlyStats: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }))
      .query(async ({ input }) => getYearlyStats(input.clientId)),
    taskTrend: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }))
      .query(async ({ input }) => getTaskTrend(input.clientId)),
    recentActivity: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => getActivityLogs({ limit: input.limit ?? 15 })),
    annualReport: protectedProcedure
      .input(z.object({ year: z.number(), clientId: z.number().optional() }))
      .query(async ({ input }) => getAnnualReport(input.year, input.clientId)),
    staticMapUrl: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { crs: crsTable } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const conditions: any[] = [eq(crsTable.status, "active")];
        if (input.clientId) conditions.push(eq(crsTable.clientId, input.clientId));
        const { clients: clientsTable } = await import("../drizzle/schema");
        const { sql: sqlFn } = await import("drizzle-orm");
        const contracts = await db
          .select({ id: crsTable.id, name: crsTable.name, state: crsTable.state, stateCode: crsTable.stateCode, country: crsTable.country, countryCode: crsTable.countryCode, tipoObra: crsTable.tipoObra, clientId: crsTable.clientId, clientName: clientsTable.name, clientCrsCode: clientsTable.crsCode })
          .from(crsTable)
          .leftJoin(clientsTable, eq(crsTable.clientId, clientsTable.id))
          .where(and(...conditions));

        // Agrupar por estado com código CRS do cliente
        const stateData: Record<string, { count: number; crsCode?: string }> = {};
        contracts.forEach((c: any) => {
          const state = c.crs.state ?? c.crs.stateCode ?? c.crs.country ?? "Brasil";
          if (!stateData[state]) {
            stateData[state] = { count: 0, crsCode: c.clients?.crsCode };
          }
          stateData[state].count += 1;
        });

        // Construir URL da Static Maps API com marcadores azuis grandes por estado
        const { ENV } = await import("./_core/env");
        const baseUrl = (ENV.forgeApiUrl ?? "").replace(/\/+$/, "");
        const apiKey = ENV.forgeApiKey ?? "";
        const url = new URL(`${baseUrl}/v1/maps/proxy/maps/api/staticmap`);
        url.searchParams.set("key", apiKey);
        url.searchParams.set("size", "800x450");
        url.searchParams.set("maptype", "roadmap");
        url.searchParams.set("scale", "2");
        url.searchParams.append("style", "feature:water|color:0xe8f4fd");
        url.searchParams.append("style", "feature:landscape|color:0xf0f4f8");
        url.searchParams.append("style", "feature:administrative.country|element:geometry.stroke|color:0x1561ad|weight:2");

        const stateEntries = Object.entries(stateData);
        if (stateEntries.length === 0) {
          url.searchParams.set("center", "-14.235,-51.9253");
          url.searchParams.set("zoom", "4");
        } else {
          stateEntries.forEach(([state, data]) => {
            // Criar label com código CRS + UF (ex: "Seinfra-BA")
            const ufCode = state.substring(0, 2).toUpperCase();
            const label = data.crsCode ? `${data.crsCode.substring(0, 3)}-${ufCode}` : (data.count <= 9 ? String(data.count) : "+");
            url.searchParams.append("markers", `color:0x1561ad|size:large|label:${encodeURIComponent(label)}|${encodeURIComponent(state + ",Brasil")}`);
          });
        }

        try {
          const response = await fetch(url.toString());
          if (!response.ok) return { url: null, contracts, stateCount: Object.fromEntries(Object.entries(stateData).map(([k, v]) => [k, v.count])) };
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          return { url: `data:image/png;base64,${base64}`, contracts, stateCount: Object.fromEntries(Object.entries(stateData).map(([k, v]) => [k, v.count])) };
        } catch {
          return { url: null, contracts, stateCount: Object.fromEntries(Object.entries(stateData).map(([k, v]) => [k, v.count])) };
        }
      }),

    contractsForPdf: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }))
      .query(async ({ input }) => getContractsForPdf(input.clientId)),
    activeSprint: protectedProcedure.query(async () => {
      const db = await getDb();
      const { sprints: sp, sprintTasks: st, tasks: t, kanbanPhases: kp, taskPhaseHistory: tph } = await import('../drizzle/schema');
      const { eq: eq2, desc: desc2, inArray: inArray2, and: and2, gte: gte2, lte: lte2 } = await import('drizzle-orm');
      // Find the most recent active sprint
      const [sprint] = await db.select().from(sp).where(eq2(sp.status, 'active')).orderBy(desc2(sp.startDate)).limit(1);
      if (!sprint) return null;
      // Get tasks in sprint with phase info
      const sprintTaskRows = await db
        .select({ id: t.id, phaseIsTerminal: kp.isTerminal })
        .from(st)
        .innerJoin(t, eq2(st.taskId, t.id))
        .leftJoin(kp, eq2(t.phaseId, kp.id))
        .where(eq2(st.sprintId, sprint.id));
      const totalTasks = sprintTaskRows.length;
      const sprintTaskIds = sprintTaskRows.map((r: any) => r.id);
      const start = new Date(sprint.startDate);
      const end = new Date(sprint.endDate);
      const msPerDay = 86400000;
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay));
      const today = new Date();
      // Get terminal phase IDs
      const terminalPhaseRows = sprintTaskIds.length > 0
        ? await db.select({ id: kp.id }).from(kp).where(eq2(kp.isTerminal, true))
        : [];
      const terminalPhaseIds = new Set(terminalPhaseRows.map((r: any) => r.id));
      // Get phase history for sprint tasks to know when each task was completed
      const phaseHistoryRows = sprintTaskIds.length > 0
        ? await db.select({ taskId: tph.taskId, toPhaseId: tph.toPhaseId, changedAt: tph.changedAt })
            .from(tph)
            .where(inArray2(tph.taskId, sprintTaskIds))
            .orderBy(tph.changedAt)
        : [];
      // For each task, find the earliest date it entered a terminal phase
      const taskCompletedAt = new Map<number, Date>();
      phaseHistoryRows.forEach((h: any) => {
        if (terminalPhaseIds.has(h.toPhaseId) && !taskCompletedAt.has(h.taskId)) {
          taskCompletedAt.set(h.taskId, new Date(h.changedAt));
        }
      });
      // Also count tasks currently in terminal phase that may not have history
      sprintTaskRows.forEach((r: any) => {
        if (r.phaseIsTerminal && !taskCompletedAt.has(r.id)) {
          taskCompletedAt.set(r.id, today); // assume completed today if no history
        }
      });
      const dataPoints: { day: number; ideal: number; real: number | null }[] = [];
      for (let d = 0; d <= totalDays; d++) {
        const dayDate = new Date(start.getTime() + d * msPerDay);
        dayDate.setHours(23, 59, 59, 999);
        const isPast = dayDate <= today;
        const completed = isPast
          ? Array.from(taskCompletedAt.values()).filter(completedDate => completedDate <= dayDate).length
          : 0;
        const remaining = totalTasks - completed;
        const ideal = Math.max(0, totalTasks - (totalTasks / totalDays) * d);
        dataPoints.push({ day: d + 1, ideal: Math.round(ideal * 10) / 10, real: isPast ? remaining : null });
      }
      return { sprint, totalTasks, dataPoints };
    }),
    weekTasks: protectedProcedure.input(z.object({ weekOffset: z.number().default(0) }).optional()).query(async ({ input }) => {
      const db = await getDb();
      const { tasks: t, crs: c, users: u, kanbanPhases: kp } = await import('../drizzle/schema');
      const { eq: eq2, and: and2, gte: gte2, lte: lte2, or: or2, isNotNull: isNotNull2 } = await import('drizzle-orm');
      const offset = input?.weekOffset ?? 0;
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1) + offset * 7); // Monday
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      const rows = await db.select({
        id: t.id, title: t.title, priority: t.priority,
        startDate: t.startDate, endDate: t.endDate, dueDate: t.dueDate,
        progress: t.progress, setor: t.setor,
        assigneeName: u.name,
        assigneeCompany: u.company,
        crsName: c.name, crsId: t.crsId,
        phaseName: kp.name, phaseColor: kp.color, phaseIsTerminal: kp.isTerminal,
      }).from(t)
        .leftJoin(u, eq2(t.assigneeId, u.id))
        .leftJoin(c, eq2(t.crsId, c.id))
        .leftJoin(kp, eq2(t.phaseId, kp.id))
        .where(
          or2(
            and2(gte2(t.startDate, startOfWeek), lte2(t.startDate, endOfWeek)),
            and2(gte2(t.endDate, startOfWeek), lte2(t.endDate, endOfWeek)),
            and2(gte2(t.dueDate, startOfWeek), lte2(t.dueDate, endOfWeek)),
            and2(lte2(t.startDate, endOfWeek), gte2(t.endDate, startOfWeek))
          )
        )
        .orderBy(t.startDate, t.dueDate);
      return rows.slice(0, 20);
    }),
    memberPerformance: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => getMemberPerformance(input?.crsId, tenantCompanyId(ctx.user))),
    contractsByState: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), company: z.string().trim().max(256).optional() }).optional())
      .query(async ({ ctx, input }) => getContractsByState(input?.company, input?.clientId, tenantCompanyId(ctx.user))),
    // ── SLA / Pontualidade ──────────────────────────────────────────────────
    slaStats: protectedProcedure
      .input(z.object({ period: z.enum(["month", "quarter", "year"]).default("month") }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const { tasks: t, kanbanPhases: kp, taskPhaseHistory: tph, crs: c } = await import('../drizzle/schema');
        const { eq: eq2, and: and2, gte: gte2, lt: lt2, sql: sqlExpr2 } = await import('drizzle-orm');
        const period = input?.period ?? "month";
        const config = getSlaPeriodConfig(period);
        const companyId = tenantCompanyId(ctx.user);
        const isUnscopedAdmin = ctx.user.role === "admin" || ctx.user.role === "master_admin";
        const tenantConditions = companyId != null
          ? [eq2(c.companyId, companyId)]
          : isUnscopedAdmin
            ? []
            : [sqlExpr2`1 = 0`];

        const completionRows = await db.select({
          taskId: tph.taskId,
          completedAt: tph.changedAt,
          dueDate: t.dueDate,
        })
          .from(tph)
          .innerJoin(kp, eq2(kp.id, tph.toPhaseId))
          .innerJoin(t, eq2(t.id, tph.taskId))
          .innerJoin(c, eq2(c.id, t.crsId))
          .where(and2(
            eq2(kp.isTerminal, true),
            gte2(tph.changedAt, config.queryStart),
            lt2(tph.changedAt, config.queryEndExclusive),
            ...tenantConditions,
          ));

        const events = completionRows as SlaHistoryEvent[];
        const current = summarizeSlaEvents(events, config.currentStart, config.queryEndExclusive);
        const previous = summarizeSlaEvents(events, config.previousStart, config.previousEndExclusive);
        const history = buildSlaHistory(events, config);
        const slaThis = current.sla;
        const slaLast = previous.sla;

        return {
          slaThis,
          slaLast,
          trend: slaThis !== null && slaLast !== null ? slaThis - slaLast : null,
          totalThis: current.total,
          onTimeThis: current.onTime,
          history: history.map((point) => ({ key: point.key, label: point.label, value: point.sla })),
          historyGranularity: config.granularity,
        };
      }),

    // ── Vencimentos Próximos ─────────────────────────────────────────────────
    upcomingDeadlines: protectedProcedure.query(async () => {
      const db = await getDb();
      const { tasks: t, kanbanPhases: kp, crs: crsTable } = await import('../drizzle/schema');
      const { eq: eq2, and: and2, isNotNull: isNotNull2, gte: gte2, lte: lte2, sql: sqlExpr2 } = await import('drizzle-orm');
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400000);
      const in15 = new Date(now.getTime() + 15 * 86400000);
      const in30 = new Date(now.getTime() + 30 * 86400000);

      // Count tasks due in each window (not in terminal phases)
      const countRows = await db.execute(
        sqlExpr2`SELECT
          SUM(CASE WHEN t.dueDate <= ${in7} THEN 1 ELSE 0 END) as next7,
          SUM(CASE WHEN t.dueDate > ${in7} AND t.dueDate <= ${in15} THEN 1 ELSE 0 END) as next15,
          SUM(CASE WHEN t.dueDate > ${in15} AND t.dueDate <= ${in30} THEN 1 ELSE 0 END) as next30
          FROM tasks t
          JOIN kanban_phases kp ON kp.id = t.phaseId AND kp.isTerminal = 0
          WHERE t.dueDate IS NOT NULL AND t.dueDate >= ${now}`
      ) as any[];

      const counts = (countRows[0] as any)?.[0] ?? {};

      // Upcoming tasks list (next 10 due)
      const upcoming = await db.execute(
        sqlExpr2`SELECT t.id, t.title, t.dueDate, t.priority, kp.name as phaseName, kp.color as phaseColor, c.name as crsName
          FROM tasks t
          JOIN kanban_phases kp ON kp.id = t.phaseId AND kp.isTerminal = 0
          LEFT JOIN crs c ON c.id = t.crsId
          WHERE t.dueDate IS NOT NULL AND t.dueDate >= ${now}
          ORDER BY t.dueDate ASC
          LIMIT 8`
      ) as any[];

      return {
        counts: {
          next7: Number(counts.next7 ?? 0),
          next15: Number(counts.next15 ?? 0),
          next30: Number(counts.next30 ?? 0),
        },
        tasks: (upcoming[0] as any[]) ?? [],
      };
    }),
    // ── Alerta Automático de Prazo (3 dias) ─────────────────────────────────
    checkDeadlineAlerts: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      const { sql: sqlExpr3 } = await import('drizzle-orm');
      const now = new Date();
      const alertDays = await getDeadlineAlertDays(ctx.user.id);
      const alertWindow = getDeadlineAlertWindow(now, alertDays);
      // Buscar tarefas com vencimento dentro da janela configurada que ainda não foram concluídas
      // e que ainda não receberam alerta de prazo hoje
      const tasksToAlert = await db.execute(
        sqlExpr3`SELECT t.id, t.title, t.dueDate, t.assigneeId, t.crsId,
          c.name as crsName, u.name as assigneeName
          FROM tasks t
          JOIN kanban_phases kp ON kp.id = t.phaseId AND kp.isTerminal = 0
          LEFT JOIN crs c ON c.id = t.crsId
          LEFT JOIN users u ON u.id = t.assigneeId
          WHERE t.dueDate IS NOT NULL
            AND t.dueDate >= ${now}
            AND t.dueDate <= ${alertWindow}
            AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.relatedTaskId = t.id
                AND n.notificationType = 'task_due'
                AND n.createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
            )`
      ) as any[];
      const rows: any[] = (tasksToAlert[0] as any[]) ?? [];
      let alertCount = 0;
      for (const task of rows) {
        const dueDate = new Date(task.dueDate);
        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        const dueDateStr = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const msg = `A tarefa "${task.title}" ${task.crsName ? `do contrato "${task.crsName}"` : ''} vence em ${daysLeft} dia(s) (${dueDateStr}). Por favor, verifique o andamento.`;
        // Notificar o responsável pela tarefa
        if (task.assigneeId) {
          await notifyUser({
            userId: task.assigneeId,
            title: `⏰ Prazo se aproximando: ${task.title}`,
            message: msg,
            notificationType: 'task_due',
            relatedCrsId: task.crsId ?? undefined,
            relatedTaskId: task.id,
          });
          alertCount++;
        }
        // Notificar o usuário atual (admin/gestor) se for diferente do responsável
        if (ctx.user.id !== task.assigneeId) {
          await notifyUser({
            userId: ctx.user.id,
            title: `⏰ Prazo se aproximando: ${task.title}`,
            message: msg,
            notificationType: 'task_due',
            relatedCrsId: task.crsId ?? undefined,
            relatedTaskId: task.id,
          });
          alertCount++;
        }
      }
      return { alertsSent: alertCount, tasksChecked: rows.length, alertDays };
    }),
  }),
  // ─── Notifications ──────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => getNotifications(ctx.user.id)),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markNotificationRead(input.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  migration: router({
    exportJson: protectedProcedure
      .input(z.object({ companyId: z.number().optional().nullable() }))
      .query(async ({ ctx, input }) => {
        const targetCompanyId = ctx.user.role === 'master_admin' ? input.companyId : ctx.user.companyId;
        const snapshot = await getCompanyMigrationSnapshot(targetCompanyId);
        return snapshot;
      }),
    importJson: adminProcedure
      .input(z.object({ jsonContent: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await importCompanyMigrationJson(input.jsonContent, ctx.user.companyId);
        return result;
      }),
  }),

  notificationPreferences: router({
    list: protectedProcedure.query(async ({ ctx }) => getNotificationPreferences(ctx.user.id)),
    updateType: protectedProcedure
      .input(z.object({ notificationType: z.enum(["task_assigned", "task_due", "phase_change", "vacation_conflict", "system_alerts"]), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => updateNotificationTypePreference(ctx.user.id, input.notificationType, input.enabled)),
    deadlineAlertDays: protectedProcedure.query(async ({ ctx }) => ({ days: await getDeadlineAlertDays(ctx.user.id) })),
    updateDeadlineAlertDays: protectedProcedure
      .input(z.object({ days: z.union([z.literal(1), z.literal(3), z.literal(7)]) }))
      .mutation(async ({ ctx, input }) => ({ days: normalizeDeadlineAlertDays(await updateDeadlineAlertDays(ctx.user.id, input.days)) })),
  }),

  // ─── Disciplines ────────────────────────────────────────────────────────────
  disciplines: router({
    list: protectedProcedure.query(async () => getDisciplines(true)),
    listAll: adminProcedure.query(async () => getDisciplines(false)),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), color: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { disciplines: disc } = await import("../drizzle/schema");
        const { sql: sqlExpr } = await import("drizzle-orm");
        const [result] = await db.execute(
          sqlExpr`INSERT INTO disciplines (name, color, description, isActive, createdById, createdAt, updatedAt)
          VALUES (${input.name}, ${input.color ?? '#6366f1'}, ${input.description ?? null}, 1, ${ctx.user.id}, NOW(), NOW())`
        );
        return { id: (result as any).insertId };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), color: z.string().optional(), description: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const { disciplines: disc } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const { id, ...data } = input;
        await db.update(disc).set({ ...data, updatedAt: new Date() }).where(eq2(disc.id, id));
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const { disciplines: disc } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        await db.delete(disc).where(eq2(disc.id, input.id));
        return { success: true };
      }),
  }),

  // ─── Agenda Events ──────────────────────────────────────────────────────────
  agenda: router({
    list: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }))
      .query(async ({ input }) => getAgendaEvents(input)),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        type: z.enum(["vacation", "meeting", "other"]).default("other"),
        startDate: z.date(),
        endDate: z.date(),
        description: z.string().optional(),
        meetingUrl: z.string().optional(),
        attendeeIds: z.string().optional(),
        crsId: z.number().optional(),
        isPublic: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createAgendaEvent({ ...input, createdById: ctx.user.id });
        return { id };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAgendaEvent(input.id);
        return { success: true };
      }),
  }),

  // ─── AI Chat ────────────────────────────────────────────────────────────────
  aiChat: router({
    getHistory: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }))
      .query(async ({ ctx, input }) => getChatMessages(ctx.user.id, input.crsId)),

    // Coleta dados reais do sistema para usar como contexto da IA
    getContext: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const companyId = tenantCompanyId(ctx.user);
        const stats = await getDashboardStats(undefined, undefined, companyId);
        const members = await getMemberPerformance(input.crsId, companyId);
        const clientProgress = await getClientProgress(undefined, undefined, companyId);
        let disciplineProgress: any[] = [];
        let crsInfo: any = null;
        let tasks: any[] = [];
        if (input.crsId) {
          disciplineProgress = await getCrsDisciplineProgress(input.crsId, companyId);
          const allCrs = await getAllCrs(undefined, undefined, companyId);
          crsInfo = allCrs.find((c: any) => c.id === input.crsId) ?? null;
          tasks = await getTasksByCrs(input.crsId, undefined, companyId);
        }
        return { stats, members, clientProgress, disciplineProgress, crsInfo, tasks };
      }),

    send: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        crsId: z.number().optional(),
        contextData: z.any().optional(), // dados reais passados pelo frontend
      }))
      .mutation(async ({ ctx, input }) => {
        await createChatMessage({ userId: ctx.user.id, crsId: input.crsId, role: "user", content: input.message });
        const history = await getChatMessages(ctx.user.id, input.crsId);
        const messages = history.map((m: any) => ({ role: m.role, content: m.content }));

        // Montar contexto do sistema com dados reais
        let systemContext = `Você é um assistente analítico especializado em gestão de projetos de engenharia e contratos. Responda em português, de forma objetiva, estruturada e com insights práticos. Use dados reais fornecidos abaixo para embasar suas respostas.`;

        if (input.contextData) {
          const ctx2 = input.contextData;
          if (ctx2.stats) {
            systemContext += `\n\n=== DADOS GERAIS DO SISTEMA ===\nContratos ativos: ${ctx2.stats.totalCrs}\nTotal de tarefas: ${ctx2.stats.totalTasks}\nTarefas concluídas: ${ctx2.stats.completedTasks}\nTarefas em andamento: ${ctx2.stats.inProgressTasks}\nTarefas pendentes: ${ctx2.stats.pendingTasks}\nTarefas em atraso: ${ctx2.stats.overdueTasks}\nProgresso médio dos contratos: ${ctx2.stats.avgProgress}%\nChecklist total: ${ctx2.stats.totalChecklist} (${ctx2.stats.completedChecklist} concluídos, ${ctx2.stats.overdueChecklist} em atraso)`;
          }
          if (ctx2.crsInfo) {
            systemContext += `\n\n=== CONTRATO SELECIONADO ===\nNome: ${ctx2.crsInfo.name}\nCódigo: ${ctx2.crsInfo.code ?? 'N/A'}\nProgresso: ${ctx2.crsInfo.progress ?? 0}%\nStatus: ${ctx2.crsInfo.status}`;
          }
          if (ctx2.members && ctx2.members.length > 0) {
            systemContext += `\n\n=== DESEMPENHO DOS MEMBROS ===`;
            for (const m of ctx2.members.slice(0, 10)) {
              systemContext += `\n- ${m.userName}: ${m.total} tarefas (${m.completed} concluídas, ${m.inProgress} em andamento, ${m.overdue} em atraso, taxa: ${m.completionRate}%)`;
            }
          }
          if (ctx2.disciplineProgress && ctx2.disciplineProgress.length > 0) {
            systemContext += `\n\n=== PROGRESSO POR DISCIPLINA ===`;
            for (const d of ctx2.disciplineProgress) {
              systemContext += `\n- ${d.name}: ${d.done}/${d.total} itens (${d.progress}%)`;
            }
          }
          if (ctx2.tasks && ctx2.tasks.length > 0) {
            const overdue = ctx2.tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && !t.phaseIsTerminal);
            const byPhase: Record<string, number> = {};
            for (const t of ctx2.tasks) { const k = t.phaseName ?? 'Sem fase'; byPhase[k] = (byPhase[k] ?? 0) + 1; }
            systemContext += `\n\n=== TAREFAS DO CONTRATO ===\nTotal: ${ctx2.tasks.length} | Em atraso: ${overdue.length}`;
            systemContext += `\nDistribuição por fase: ${Object.entries(byPhase).map(([k,v]) => k+': '+v).join(', ')}`;
          }
          if (ctx2.clientProgress && ctx2.clientProgress.length > 0) {
            systemContext += `\n\n=== PROGRESSO POR CLIENTE ===`;
            for (const c of ctx2.clientProgress.slice(0, 8)) {
              systemContext += `\n- ${c.clientName}: ${c.crsCount} contratos, progresso médio ${c.avgProgress ?? 0}%`;
            }
          }
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemContext },
            ...messages,
          ],
        });
        const reply = (response?.choices?.[0]?.message?.content as string | null) ?? "Desculpe, não consegui processar sua mensagem.";
        await createChatMessage({ userId: ctx.user.id, crsId: input.crsId, role: "assistant", content: reply });
        return { reply };
      }),

    clearHistory: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { chatMessages: cm } = await import("../drizzle/schema");
        const { eq: eq2, and: and2 } = await import("drizzle-orm");
        if (input.crsId) {
          await db.delete(cm).where(and2(eq2(cm.userId, ctx.user.id), eq2(cm.crsId, input.crsId)));
        } else {
          await db.delete(cm).where(eq2(cm.userId, ctx.user.id));
        }
        return { success: true };
      }),
  }),

  // ─── Direct Messages ────────────────────────────────────────────────────────
  messages: router({
    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return getUserConversations(ctx.user.id);
    }),
    getGroupConversations: protectedProcedure.query(async ({ ctx }) => {
      return getGroupConversations(ctx.user.id);
    }),
    getOrCreate: protectedProcedure
      .input(z.object({ otherUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const id = await getOrCreateConversation(ctx.user.id, input.otherUserId);
        return { id };
      }),
    createGroup: protectedProcedure
      .input(z.object({ name: z.string().min(1), memberIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        const id = await createGroupConversation(ctx.user.id, input.name, input.memberIds);
        return { id };
      }),
    getMembers: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => getConversationMembers(input.conversationId)),
    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => getDirectMessages(input.conversationId)),
    getTypingUsers: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => getChatTypingUsers(input.conversationId, ctx.user.id)),
    markRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => ({ success: await markConversationAsRead(input.conversationId, ctx.user.id, tenantCompanyId(ctx.user)) })),
    setTyping: protectedProcedure
      .input(z.object({ conversationId: z.number(), isTyping: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (input.isTyping) {
          await setChatTypingState(input.conversationId, ctx.user.id);
        } else {
          await clearChatTypingState(input.conversationId, ctx.user.id);
        }
        return { success: true };
      }),
    send: protectedProcedure
      .input(z.object({ conversationId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const id = await sendDirectMessage({ conversationId: input.conversationId, senderId: ctx.user.id, content: input.content });
        await clearChatTypingState(input.conversationId, ctx.user.id);
        // Notify other members of the conversation
        try {
          const members = await getConversationMembers(input.conversationId);
          const senderName = ctx.user.name ?? ctx.user.email ?? "Alguém";
          for (const m of members) {
            if (m.userId !== ctx.user.id) {
              await notifyUser({
                userId: m.userId,
                title: `Nova mensagem de ${senderName}`,
                message: input.content.length > 80 ? input.content.slice(0, 80) + "..." : input.content,
                notificationType: "chat_message" as any,
              });
            }
          }
        } catch {}
        return { id };
      }),
  }),

  // ─── Sprints ────────────────────────────────────────────────────────────────
  sprints: router({
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const result = await getSprintWithTasks(input.id);
        if (!result) throw new TRPCError({ code: "NOT_FOUND" });
        return result;
      }),
    addTask: protectedProcedure
      .input(z.object({ sprintId: z.number(), taskId: z.number() }))
      .mutation(async ({ input }) => {
        await addTaskToSprint(input.sprintId, input.taskId);
        return { success: true };
      }),
    removeTask: protectedProcedure
      .input(z.object({ sprintId: z.number(), taskId: z.number() }))
      .mutation(async ({ input }) => {
        await removeTaskFromSprint(input.sprintId, input.taskId);
        return { success: true };
      }),
    listByCrs: protectedProcedure
      .input(z.object({ crsId: z.number() }))
      .query(async ({ input }) => getSprintsByCrs(input.crsId)),
    listAll: protectedProcedure.query(async () => {
      const db = await getDb();
      const { sprints: sp, crs: crsTable } = await import('../drizzle/schema');
      const { eq: eq2, asc: asc2 } = await import('drizzle-orm');
      return db.select({
        id: sp.id, name: sp.name, goal: sp.goal, status: sp.status,
        startDate: sp.startDate, endDate: sp.endDate, crsId: sp.crsId,
        crsName: crsTable.name, crsCode: crsTable.code,
      }).from(sp).leftJoin(crsTable, eq2(sp.crsId, crsTable.id)).orderBy(asc2(sp.startDate));
    }),
    create: adminProcedure
      .input(z.object({
        crsId: z.number(),
        name: z.string().min(1),
        goal: z.string().optional(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { sprints: sp } = await import("../drizzle/schema");
        const { sql: sqlExpr } = await import("drizzle-orm");
        const [result] = await db.execute(
          sqlExpr`INSERT INTO sprints (crsId, name, goal, startDate, endDate, status, createdById, createdAt)
          VALUES (${input.crsId}, ${input.name}, ${input.goal ?? null}, ${input.startDate}, ${input.endDate}, 'planned', ${ctx.user.id}, NOW())`
        );
        return { id: (result as any).insertId };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), goal: z.string().optional(), status: z.enum(["active", "completed", "planned"]).optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const { sprints: sp } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const { id, ...data } = input;
        await db.update(sp).set(data).where(eq2(sp.id, id));
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const { sprints: sp } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        await db.delete(sp).where(eq2(sp.id, input.id));
        return { success: true };
      }),
    // ─── Checklist Items na Sprint ──────────────────────────────────────────────────
    listChecklistItems: protectedProcedure
      .input(z.object({ sprintId: z.number() }))
      .query(async ({ input }) => getSprintChecklistItems(input.sprintId)),
    // All checklist items for a CRS (to pick from when adding to sprint)
    listAvailableChecklistItems: protectedProcedure
      .input(z.object({ crsId: z.number().optional(), clientId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { checklistItems: ci, tasks: t, users: u, crs: crsTable, clients: clientsTable } = await import("../drizzle/schema");
        const { eq: eq2, inArray, and: and2 } = await import("drizzle-orm");
        // Build filter: by crsId, or by clientId, or all
        let taskQuery = db.select({ id: t.id, crsId: t.crsId }).from(t)
          .innerJoin(crsTable, eq2(t.crsId, crsTable.id));
        if (input.crsId) {
          taskQuery = taskQuery.where(eq2(t.crsId, input.crsId)) as any;
        } else if (input.clientId) {
          taskQuery = taskQuery.where(eq2(crsTable.clientId, input.clientId)) as any;
        }
        const crsTaskRows = await taskQuery;
        if (crsTaskRows.length === 0) return [];
        const taskIds = crsTaskRows.map((r: any) => r.id);
        return db.select({
          id: ci.id,
          title: ci.title,
          status: ci.status,
          startDate: ci.startDate,
          endDate: ci.endDate,
          assigneeId: ci.assigneeId,
          assigneeName: u.name,
          assigneeCompany: u.company,
          taskId: ci.taskId,
          taskTitle: t.title,
          taskSetor: t.setor,
          taskCrsId: t.crsId,
          crsName: crsTable.name,
          crsCode: crsTable.code,
          clientId: clientsTable.id,
          clientName: clientsTable.name,
        }).from(ci)
          .leftJoin(u, eq2(ci.assigneeId, u.id))
          .innerJoin(t, eq2(ci.taskId, t.id))
          .innerJoin(crsTable, eq2(t.crsId, crsTable.id))
          .leftJoin(clientsTable, eq2(crsTable.clientId, clientsTable.id))
          .where(inArray(ci.taskId, taskIds))
          .orderBy(clientsTable.name, crsTable.name, t.setor, t.title, ci.title);
      }),
    addChecklistItem: protectedProcedure
      .input(z.object({ sprintId: z.number(), checklistItemId: z.number() }))
      .mutation(async ({ input }) => {
        await addChecklistItemToSprint(input.sprintId, input.checklistItemId);
        return { success: true };
      }),
    removeChecklistItem: protectedProcedure
      .input(z.object({ sprintId: z.number(), checklistItemId: z.number() }))
      .mutation(async ({ input }) => {
        await removeChecklistItemFromSprint(input.sprintId, input.checklistItemId);
        return { success: true };
      }),
  }),

  // ─── Whiteboard ──────────────────────────────────────────────────────────────
  whiteboard: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWhiteboardsByUser(ctx.user.id);
    }),
    save: protectedProcedure
      .input(z.object({ pageIndex: z.number(), title: z.string(), dataUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const id = await saveWhiteboard(ctx.user.id, input.pageIndex, input.title, input.dataUrl);
        return { id };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteWhiteboard(input.id, ctx.user.id);
        return { success: true };
      }),
    rename: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await renameWhiteboard(input.id, ctx.user.id, input.title);
        return { success: true };
      }),
  }),
  // ─── System ─────────────────────────────────────────────────────────────────
  system: router({
    notifyOwner: protectedProcedure
      .input(z.object({ title: z.string(), content: z.string() }))
      .mutation(async ({ input }) => {
        const success = await notifyOwner(input);
        return { success };
      }),
    checkDueSoon: protectedProcedure
      .mutation(async () => {
        // Find tasks due within 5 days that haven't been notified yet
        const db = await getDb();
        const { tasks: tasksTable } = await import("../drizzle/schema");
        const { and: and2, isNotNull, lte, gte, ne } = await import("drizzle-orm");
        const now = new Date();
        const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        const dueSoonTasks = await db.select({
          id: tasksTable.id,
          title: tasksTable.title,
          assigneeId: tasksTable.assigneeId,
          dueDate: tasksTable.dueDate,
        })
          .from(tasksTable)
          .where(
            and2(
              isNotNull(tasksTable.assigneeId),
              isNotNull(tasksTable.dueDate),
              gte(tasksTable.dueDate, now),
              lte(tasksTable.dueDate, in5Days),
            )
          )
          .limit(100);
        let notified = 0;
        for (const t of dueSoonTasks) {
          if (!t.assigneeId) continue;
          const daysLeft = Math.ceil((new Date(t.dueDate!).getTime() - now.getTime()) / 86400000);
          await notifyUser({
            userId: t.assigneeId,
            title: `Prazo se aproximando: "${t.title}"`,
            message: `Esta tarefa vence em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}.`,
            notificationType: "task_due",
            relatedTaskId: t.id,
          });
          notified++;
        }
        return { notified };
      }),
  }),

  googleCalendar: router({
    getAuthUrl: protectedProcedure.query(({ ctx }) => {
      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
      const protocol = (ctx.req.headers['x-forwarded-proto'] as string) || 'https';
      const host = (ctx.req.headers['x-forwarded-host'] as string) || (ctx.req.headers.host as string) || 'localhost:3000';
      const redirectUri = `${protocol}://${host}/api/oauth/google/callback`;
      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/meetings.space.created",
      ];
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.append("client_id", clientId!);
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("scope", scopes.join(" "));
      authUrl.searchParams.append("state", createGoogleOAuthState(ctx.user.id));
      authUrl.searchParams.append("access_type", "offline");
      authUrl.searchParams.append("include_granted_scopes", "true");
      authUrl.searchParams.append("prompt", "consent");
      return { authUrl: authUrl.toString() };
    }),
    isConnected: protectedProcedure.query(async ({ ctx }) => {
      const token = await getGoogleCalendarToken(ctx.user.id);
      return { connected: !!token };
    }),
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteGoogleCalendarToken(ctx.user.id);
      return { success: true };
    }),
    listEvents: protectedProcedure.query(async ({ ctx }) => {
      return await getGoogleCalendarEventsByUser(ctx.user.id);
    }),
    syncEvents: protectedProcedure.mutation(async ({ ctx }) => {
      return await syncGoogleCalendarEvents(ctx.user.id);
    }),
    createEvent: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1).max(256),
        description: z.string().max(5000).optional(),
        startDate: z.date(),
        endDate: z.date(),
        attendeeEmails: z.array(z.string().email()).max(50).default([]),
        agendaEventId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.endDate <= input.startDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O horário de término deve ser posterior ao início." });
        }
        const event = await createGoogleCalendarEvent({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          attendeeEmails: Array.from(new Set(input.attendeeEmails)),
        });
        await saveGoogleCalendarEvent(ctx.user.id, {
          ...event,
          agendaEventId: input.agendaEventId,
          isSynced: true,
        });
        return event;
      }),
  }),

  floatingAgent: router({
    chat: protectedProcedure
      .input(z.object({ message: z.string().trim().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        return await processFloatingAgentCommand(ctx.user.id, ctx.user.companyId ?? null, input.message);
      }),
    listMemories: protectedProcedure.query(async ({ ctx }) => {
      return await getUserAiMemories(ctx.user.id);
    }),
    addMemory: protectedProcedure
      .input(z.object({ content: z.string().min(2).max(500), category: z.string().max(64).default("general") }))
      .mutation(async ({ ctx, input }) => {
        const id = await addUserAiMemory(ctx.user.id, input.content, input.category);
        return { id, success: true };
      }),
    deleteMemory: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteUserAiMemory(input.id, ctx.user.id);
      }),
  }),

  meetings: router({
    list: protectedProcedure
      .input(z.object({ crsId: z.number().optional(), taskId: z.number().optional(), from: z.date().optional(), to: z.date().optional() }).optional())
      .query(async ({ input }) => getMeetings(input ?? undefined)),

    create: protectedProcedure
      .input(z.object({
        crsId: z.number().int().positive(),
        taskId: z.number().int().positive().optional(),
        title: z.string().trim().min(2).max(256),
        description: z.string().max(5000).optional(),
        startDate: z.date(),
        endDate: z.date(),
        participantEmails: z.array(z.string().email()).max(50).default([]),
        participantIds: z.array(z.number().int().positive()).max(50).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.endDate <= input.startDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O horário de término deve ser posterior ao início." });
        }
        if (input.taskId) {
          const task = await getTaskById(input.taskId);
          if (!task || task.crsId !== input.crsId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A tarefa informada não pertence ao CRS selecionado." });
          }
        }
        const googleMeeting = await createGoogleCalendarMeeting({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          attendeeEmails: Array.from(new Set(input.participantEmails)),
          crsId: input.crsId,
          taskId: input.taskId,
        });
        const id = await createMeeting({
          createdById: ctx.user.id,
          crsId: input.crsId,
          taskId: input.taskId,
          title: input.title,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          participantIds: JSON.stringify(input.participantIds),
          participantEmails: JSON.stringify(Array.from(new Set(input.participantEmails))),
          ...googleMeeting,
        });
        return { id, ...googleMeeting };
      }),

    syncReport: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const meeting = await getMeetingById(input.id);
        if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Reunião não encontrada." });
        if (meeting.createdById !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Somente o criador pode sincronizar o relatório desta reunião." });
        }
        if (!meeting.meetingCode) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta reunião ainda não possui um código do Google Meet." });
        }
        const report = await syncGoogleMeetReport(ctx.user.id, meeting.meetingCode);
        if (!report) return { found: false };
        await updateMeeting(input.id, {
          actualParticipants: JSON.stringify(report.participants),
          actualStartDate: report.actualStartDate,
          actualEndDate: report.actualEndDate,
          status: "completed",
          lastSyncedAt: new Date(),
        });
        return { found: true, ...report };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const meeting = await getMeetingById(input.id);
        if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Reunião não encontrada." });
        if (meeting.createdById !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Somente o criador pode remover esta reunião." });
        }
        await deleteMeeting(input.id);
        return { success: true };
      }),
  }),

  subscription: router({
    listPlans: publicProcedure.query(async () => {
      const plans = await getSubscriptionPlans();
      return plans.map((p: any) => ({
        id: p.id,
        name: p.name,
        monthlyPrice: p.monthlyPrice,
        annualPrice: p.annualPrice,
        maxUsers: p.maxUsers,
        maxProjects: p.maxProjects,
        features: p.features ? JSON.parse(p.features) : [],
        description: p.description,
      }));
    }),

    getStatus: protectedProcedure.query(async ({ ctx }) => {
      return await getSubscriptionStatus(ctx.user.id);
    }),

    createCheckoutSession: protectedProcedure.input((v: any) => ({
      planId: v.planId,
      billingCycle: v.billingCycle || "monthly",
    })).mutation(async ({ ctx, input }) => {
      const plan = await getSubscriptionPlanById(input.planId);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano nao encontrado" });

      const origin = ctx.req?.headers.origin || "https://orbita.manus.space";

      const session = await stripeClient.checkout.sessions.create({
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          plan_id: input.planId.toString(),
          billing_cycle: input.billingCycle,
        },
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${origin}/dashboard?checkout=success`,
        cancel_url: `${origin}/pricing?checkout=canceled`,
        allow_promotion_codes: true,
      });

      return { checkoutUrl: session.url };
    }),

    getInvoices: protectedProcedure.query(async ({ ctx }) => {
      return await getUserInvoices(ctx.user.id);
    }),

    cancel: protectedProcedure.input((v: any) => ({
      reason: v.reason,
    })).mutation(async ({ ctx, input }) => {
      const sub = await getUserSubscription(ctx.user.id);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura nao encontrada" });

      if (sub.stripeSubscriptionId) {
        await stripeClient.subscriptions.cancel(sub.stripeSubscriptionId);
      }

      await cancelUserSubscription(sub.id, input.reason);
      return { success: true };
    }),

    checkAccess: protectedProcedure.query(async ({ ctx }) => {
      const hasAccess = await hasActiveSubscription(ctx.user.id);
      const isTrialing = await isTrialPeriod(ctx.user.id);
      return { hasAccess, isTrialing };
    }),
  }),

  // ─── Two-Factor Authentication (2FA) for Admins ─────────────────────────────
  tfa: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "company_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o 2FA." });
      }
      const db = await getDb();
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq: eq2 } = await import("drizzle-orm");
      const [user] = await db.select({
        tfaEnabled: usersTable.tfaEnabled,
        tfaMethod: usersTable.tfaMethod,
        email: usersTable.email,
      }).from(usersTable).where(eq2(usersTable.id, ctx.user.id));
      return {
        enabled: user?.tfaEnabled ?? false,
        method: user?.tfaMethod ?? "totp",
        email: user?.email ? maskEmail(user.email) : null,
        emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      };
    }),

    sendEmailCode: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "company_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o 2FA." });
      }
      try {
        const result = await generateAndSendEmailTfaCode(ctx.user.id);
        await logActivity({ userId: ctx.user.id, action: "tfa_email_code_sent", entityType: "user", entityId: ctx.user.id, metadata: JSON.stringify({ method: "email" }) });
        return result;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível enviar o código 2FA." });
      }
    }),

    verifyEmailAndEnable: protectedProcedure
      .input(z.object({ token: z.string().regex(/^\d{6}$/) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "company_admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o 2FA." });
        }
        const result = await verifyEmailTfaCode(ctx.user.id, input.token);
        if (!result.valid) {
          const messages = {
            invalid_format: "Informe um código de 6 dígitos.",
            missing: "Solicite um novo código por e-mail.",
            expired: "O código expirou. Solicite um novo código.",
            incorrect: "Código incorreto.",
            locked: "Muitas tentativas. Solicite um novo código.",
          } as const;
          throw new TRPCError({ code: "BAD_REQUEST", message: messages[result.reason] });
        }
        await logActivity({ userId: ctx.user.id, action: "tfa_email_enabled", entityType: "user", entityId: ctx.user.id, metadata: JSON.stringify({ method: "email" }) });
        return { success: true };
      }),

    setup: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "company_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o 2FA." });
      }
      const { generateTfaSecret, getTotpOtpAuthUrl } = await import("./tfa");
      const secret = generateTfaSecret();
      const db = await getDb();
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq: eq2 } = await import("drizzle-orm");
      await db.update(usersTable).set({ tfaSecret: secret, tfaMethod: "totp" }).where(eq2(usersTable.id, ctx.user.id));
      const otpauth = getTotpOtpAuthUrl(secret, ctx.user.email ?? "admin@orbita.com.br");
      return { secret, otpauth };
    }),

    verifyAndEnable: protectedProcedure
      .input(z.object({ token: z.string().length(6) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "company_admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o 2FA." });
        }
        const db = await getDb();
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const [user] = await db.select({ tfaSecret: usersTable.tfaSecret }).from(usersTable).where(eq2(usersTable.id, ctx.user.id));
        if (!user?.tfaSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Configuração de 2FA não iniciada." });
        const { verifyTotpToken, generateBackupCodes } = await import("./tfa");
        if (!verifyTotpToken(user.tfaSecret, input.token)) throw new TRPCError({ code: "BAD_REQUEST", message: "Código TOTP inválido ou expirado." });
        const backupCodes = generateBackupCodes(8);
        await db.update(usersTable).set({ tfaEnabled: true, tfaMethod: "totp", tfaBackupCodes: JSON.stringify(backupCodes), tfaCodeHash: null, tfaCodeExpiresAt: null, tfaCodeAttempts: 0 }).where(eq2(usersTable.id, ctx.user.id));
        return { success: true, backupCodes };
      }),

    disable: protectedProcedure
      .input(z.object({ token: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "master_admin" && ctx.user.role !== "company_admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o 2FA." });
        }
        const db = await getDb();
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const [user] = await db.select({ tfaSecret: usersTable.tfaSecret, tfaEnabled: usersTable.tfaEnabled, tfaBackupCodes: usersTable.tfaBackupCodes, tfaMethod: usersTable.tfaMethod }).from(usersTable).where(eq2(usersTable.id, ctx.user.id));
        if (!user?.tfaEnabled) return { success: true };

        if (user.tfaMethod === "email") {
          const emailResult = await verifyEmailTfaCode(ctx.user.id, input.token);
          if (!emailResult.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código de e-mail inválido, expirado ou bloqueado." });
        } else {
          const { verifyTotpToken } = await import("./tfa");
          let isValid = verifyTotpToken(user.tfaSecret ?? "", input.token);
          if (!isValid && user.tfaBackupCodes) {
            try {
              const codes = JSON.parse(user.tfaBackupCodes) as string[];
              if (codes.includes(input.token.trim())) isValid = true;
            } catch {}
          }
          if (!isValid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificação ou backup inválido." });
        }

        await db.update(usersTable).set({ tfaEnabled: false, tfaSecret: null, tfaBackupCodes: null, tfaCodeHash: null, tfaCodeExpiresAt: null, tfaCodeAttempts: 0 }).where(eq2(usersTable.id, ctx.user.id));
        await logActivity({ userId: ctx.user.id, action: "tfa_disabled", entityType: "user", entityId: ctx.user.id, metadata: JSON.stringify({ method: user.tfaMethod }) });
        return { success: true };
      }),
  }),

  // ─── Custom Domains & Tenant Branding (Multi-Tenant v4.0) ──────────────────
  tenant: router({
    context: publicProcedure.query(({ ctx }) => {
      if (!ctx.tenant) return null;
      return ctx.tenant;
    }),

    listDomains: companyAdminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const { companyDomains, companies } = await import('../drizzle/schema');
      const { eq, desc } = await import('drizzle-orm');
      const query = db.select({
        id: companyDomains.id,
        companyId: companyDomains.companyId,
        companyName: companies.name,
        domain: companyDomains.domain,
        status: companyDomains.status,
        verifiedAt: companyDomains.verifiedAt,
        verificationToken: companyDomains.verificationToken,
        isPrimary: companyDomains.isPrimary,
        sslStatus: companyDomains.sslStatus,
        sslExpiresAt: companyDomains.sslExpiresAt,
        createdAt: companyDomains.createdAt,
      }).from(companyDomains)
        .leftJoin(companies, eq(companyDomains.companyId, companies.id))
        .orderBy(desc(companyDomains.createdAt));
      if (ctx.user.role === "master_admin") return query;
      return query.where(eq(companyDomains.companyId, ctx.user.companyId!));
    }),

    addDomain: companyAdminProcedure
      .input(z.object({ companyId: z.number().int().positive(), domain: z.string().min(3).max(255) }))
      .mutation(async ({ ctx, input }) => {
        if (!canManageCompanyDomain(ctx.user, input.companyId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode gerenciar domínios da sua empresa." });
        }
        const cleanDomain = normalizeCustomDomain(input.domain);
        const db = await getDb();
        const { companyDomains } = await import('../drizzle/schema');
        const verificationToken = `orbita-verify-${randomBytes(24).toString("hex")}`;
        const inserted = await db.insert(companyDomains).values({
          companyId: input.companyId,
          domain: cleanDomain,
          status: "pending",
          verificationToken,
          isPrimary: false,
        });
        const id = Number((inserted as any)[0]?.insertId ?? 0);
        return { id, success: true, verificationToken, domain: cleanDomain, txtHost: `_orbita-verification.${cleanDomain}` };
      }),

    verifyDomain: companyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { companyDomains } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const [record] = await db.select().from(companyDomains).where(eq(companyDomains.id, input.id)).limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Domínio não encontrado." });
        if (!canManageCompanyDomain(ctx.user, record.companyId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode verificar o domínio de outra empresa." });
        }
        if (!record.verificationToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Este domínio não possui token de verificação." });
        try {
          const txtRecords = await resolveTxt(`_orbita-verification.${record.domain}`);
          const values = txtRecords.flat().map((value) => value.trim());
          if (!values.includes(record.verificationToken)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "O registro TXT ainda não corresponde ao token do Orbita." });
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível localizar o registro TXT. Verifique o DNS e tente novamente." });
        }
        await db.update(companyDomains).set({ status: "verified", verifiedAt: new Date() }).where(eq(companyDomains.id, input.id));
        return { success: true };
      }),

    setPrimary: companyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { companyDomains } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const [record] = await db.select().from(companyDomains).where(eq(companyDomains.id, input.id)).limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Domínio não encontrado." });
        if (!canManageCompanyDomain(ctx.user, record.companyId)) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode alterar este domínio." });
        if (record.status !== "verified") throw new TRPCError({ code: "BAD_REQUEST", message: "Somente domínios verificados podem ser primários." });
        await db.update(companyDomains).set({ isPrimary: false }).where(eq(companyDomains.companyId, record.companyId));
        await db.update(companyDomains).set({ isPrimary: true }).where(and(eq(companyDomains.id, input.id), eq(companyDomains.companyId, record.companyId)));
        return { success: true };
      }),

    removeDomain: companyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { companyDomains } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const [record] = await db.select().from(companyDomains).where(eq(companyDomains.id, input.id)).limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Domínio não encontrado." });
        if (!canManageCompanyDomain(ctx.user, record.companyId)) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode remover este domínio." });
        await db.delete(companyDomains).where(eq(companyDomains.id, input.id));
        return { success: true };
      }),

    renewSsl: companyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const { companyDomains } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const [record] = await db.select().from(companyDomains).where(eq(companyDomains.id, input.id)).limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Domínio não encontrado." });
        if (!canManageCompanyDomain(ctx.user, record.companyId)) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode gerenciar este domínio." });
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 dias
        await db.update(companyDomains).set({ sslStatus: "active", sslExpiresAt: expiresAt }).where(eq(companyDomains.id, input.id));
        return { success: true, sslExpiresAt: expiresAt };
      }),
  }),
});

export type AppRouter = typeof appRouter;
