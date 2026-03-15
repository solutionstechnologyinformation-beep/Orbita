import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import {
  getUserByOpenId, createUser, updateUser, getAllUsers,
  getClients, getAllClients, getClientById, createClient, updateClient, deleteClient,
  getCrsByClient, getAllCrs, getArchivedCrs, getCrsById, createCrs, updateCrs, deleteCrs, recalcCrsProgress,
  getPhasesByCrs, createPhase, updatePhase, deletePhase,
  getTasksByCrs, getTaskById, createTask, updateTask, deleteTask, recalcTaskProgress,
  getTaskComments, createTaskComment, deleteTaskComment,
  getChecklistItems, createChecklistItem, updateChecklistItem, deleteChecklistItem, getCrsDateRange,
  getChecklistItemComments, createChecklistItemComment,
  recordPhaseChange, getTaskPhaseHistory, getChecklistItemHistory,
  getVacationPeriods, createVacationPeriod, deleteVacationPeriod, isUserOnVacation,
  notifyUser, getNotifications, markNotificationRead, markAllNotificationsRead,
  logActivity, getDisciplines, getDashboardStats, getWorldMapData, getWeekDeliveries,
  getAgendaEvents, createAgendaEvent, deleteAgendaEvent,
  getChatMessages, createChatMessage,
  getOrCreateConversation, getDirectMessages, sendDirectMessage, getUserConversations,
  createGroupConversation, getGroupConversations, getConversationMembers, getTasksInVacationPeriod,
  getSprintsByCrs, getDb,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";

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
    updateProfile: protectedProcedure
      .input(z.object({ name: z.string().optional(), avatarUrl: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await updateUser(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Users ─────────────────────────────────────────────────────────────────
  users: router({
    list: protectedProcedure.query(async () => {
      return getAllUsers();
    }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "leader"]) }))
      .mutation(async ({ input }) => {
        await updateUser(input.userId, { role: input.role as any });
        return { success: true };
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
      .input(z.object({ name: z.string().min(1), description: z.string().optional(), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await createClient({ ...input, createdById: ctx.user.id });
        await logActivity({ userId: ctx.user.id, action: "created_client", entityType: "client", entityId: id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), color: z.string().optional(), status: z.enum(["active", "archived"]).optional() }))
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
    list: protectedProcedure.query(async () => getAllCrs()),
    listByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => getCrsByClient(input.clientId)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const c = await getCrsById(input.id);
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
        tipoObra: z.enum(["implementacao", "restauracao", "aumento_capacidade", "levantamento", "outro"]).optional(),
        extensaoKm: z.number().optional(),
        areaHa: z.number().optional(),
        perimetroUrbano: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createCrs({ ...input, createdById: ctx.user.id });
        await logActivity({ userId: ctx.user.id, action: "created_crs", entityType: "crs", entityId: id });
        return { id };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        description: z.string().optional(),
        country: z.string().optional(),
        countryCode: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        status: z.enum(["active", "archived"]).optional(),
        tipoObra: z.enum(["implementacao", "restauracao", "aumento_capacidade", "levantamento", "outro"]).nullable().optional(),
        extensaoKm: z.number().nullable().optional(),
        areaHa: z.number().nullable().optional(),
        perimetroUrbano: z.number().int().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCrs(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCrs(input.id);
        return { success: true };
      }),
    listArchived: protectedProcedure.query(async () => getArchivedCrs()),
    archive: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCrs(input.id, { status: "archived" });
        return { success: true };
      }),
    restore: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCrs(input.id, { status: "active" });
        return { success: true };
      }),
     worldMap: protectedProcedure.query(async () => getWorldMapData()),
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
      .query(async ({ input }) => getPhasesByCrs(input.crsId)),
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
    listForGantt: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        crsId: z.number().optional(),
        setor: z.string().optional(),
        assigneeId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getDb: db2 } = await import('./db');
        const { tasks: t, crs: c, users: u, kanbanPhases: kp, clients: cl } = await import('../drizzle/schema');
        const { eq: eq2, and: and2, like: like2 } = await import('drizzle-orm');
        const db = await db2();
        const conditions: any[] = [];
        if (input.crsId) conditions.push(eq2(t.crsId, input.crsId));
        if (input.assigneeId) conditions.push(eq2(t.assigneeId, input.assigneeId));
        if (input.setor) conditions.push(eq2(t.setor, input.setor));
        const rows = await db.select({
          id: t.id, crsId: t.crsId, phaseId: t.phaseId,
          title: t.title, priority: t.priority,
          assigneeId: t.assigneeId, dueDate: t.dueDate,
          startDate: t.startDate, endDate: t.endDate,
          setor: t.setor, progress: t.progress,
          assigneeName: u.name,
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
        return input.clientId ? rows.filter((r: any) => r.clientId === input.clientId) : rows;
      }),
    listByCrs: protectedProcedure
      .input(z.object({
        crsId: z.number(),
        phaseId: z.number().optional(),
        priority: z.string().optional(),
        assigneeId: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { crsId, ...filters } = input;
        return getTasksByCrs(crsId, filters);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const task = await getTaskById(input.id);
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
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const task = await getTaskById(id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        // Record phase change history
        if (data.phaseId !== undefined && data.phaseId !== task.phaseId) {
          const { getDb: db2 } = await import("./db");
          const { kanbanPhases } = await import("../drizzle/schema");
          const { eq: eq2 } = await import("drizzle-orm");
          const dbConn = await db2();
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
        await updateTask(id, data);
        return { success: true };
      }),
    movePhase: protectedProcedure
      .input(z.object({ id: z.number(), phaseId: z.number(), position: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.phaseId !== task.phaseId) {
          const { getDb: db2 } = await import("./db");
          const { kanbanPhases } = await import("../drizzle/schema");
          const { eq: eq2 } = await import("drizzle-orm");
          const dbConn = await db2();
          const [fromPhase] = await dbConn.select({ name: kanbanPhases.name }).from(kanbanPhases).where(eq2(kanbanPhases.id, task.phaseId)).limit(1);
          const [toPhase] = await dbConn.select({ name: kanbanPhases.name }).from(kanbanPhases).where(eq2(kanbanPhases.id, input.phaseId)).limit(1);
          await recordPhaseChange({
            taskId: input.id, changedById: ctx.user.id,
            fromPhaseId: task.phaseId, fromPhaseName: fromPhase?.name,
            toPhaseId: input.phaseId, toPhaseName: toPhase?.name ?? "Desconhecida",
          });
        }
        await updateTask(input.id, { phaseId: input.phaseId, position: input.position ?? task.position });
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
        return { id };
      }),
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTaskComment(input.id);
        return { success: true };
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const { checklistItems: ci } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const [item] = await db.select({ taskId: ci.taskId }).from(ci).where(eq2(ci.id, input.id)).limit(1);
        await deleteChecklistItem(input.id);
        if (item) await recalcTaskProgress(item.taskId);
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

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async () => getDashboardStats()),
    worldMap: protectedProcedure.query(async () => getWorldMapData()),
    weekDeliveries: protectedProcedure.query(async () => getWeekDeliveries()),
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
    send: protectedProcedure
      .input(z.object({ message: z.string().min(1), crsId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await createChatMessage({ userId: ctx.user.id, crsId: input.crsId, role: "user", content: input.message });
        const history = await getChatMessages(ctx.user.id, input.crsId);
        const messages = history.map((m: any) => ({ role: m.role, content: m.content }));
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um assistente de gestão de projetos e contratos CRS. Responda de forma objetiva e útil." },
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
      const result = await getUserConversations(ctx.user.id);
      return (result[0] as any[]) ?? [];
    }),
    getGroupConversations: protectedProcedure.query(async ({ ctx }) => {
      const result = await getGroupConversations(ctx.user.id);
      return (result[0] as any[]) ?? [];
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
    send: protectedProcedure
      .input(z.object({ conversationId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const id = await sendDirectMessage({ conversationId: input.conversationId, senderId: ctx.user.id, content: input.content });
        return { id };
      }),
  }),

  // ─── Sprints ────────────────────────────────────────────────────────────────
  sprints: router({
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { sprints: sp, tasks } = await import("../drizzle/schema");
        const { eq: eq2 } = await import("drizzle-orm");
        const [sprint] = await db.select().from(sp).where(eq2(sp.id, input.id));
        if (!sprint) throw new TRPCError({ code: "NOT_FOUND" });
        return { ...sprint, tasks: [] };
      }),
    listByCrs: protectedProcedure
      .input(z.object({ crsId: z.number() }))
      .query(async ({ input }) => getSprintsByCrs(input.crsId)),
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
  }),

  // ─── System ─────────────────────────────────────────────────────────────────
  system: router({
    notifyOwner: protectedProcedure
      .input(z.object({ title: z.string(), content: z.string() }))
      .mutation(async ({ input }) => {
        const success = await notifyOwner(input);
        return { success };
      }),
  }),
});

export type AppRouter = typeof appRouter;
