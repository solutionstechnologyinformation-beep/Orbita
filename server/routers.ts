import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import {
  updateUser, getAllUsers, deleteUser, getMemberPerformance,
  getClients, getAllClients, getClientById, createClient, updateClient, deleteClient,
  getCrsByClient, getAllCrs, getArchivedCrs, getCrsById, createCrs, updateCrs, deleteCrs,
  getPhasesByCrs, createPhase, updatePhase, deletePhase,
  getTasksByCrs, getTaskById, createTask, updateTask, deleteTask, recalcTaskProgress,
  getTaskComments, createTaskComment, deleteTaskComment,
  getChecklistItems, createChecklistItem, updateChecklistItem, deleteChecklistItem, getCrsDateRange,
  getChecklistItemComments, createChecklistItemComment,
  recordPhaseChange, getTaskPhaseHistory, getChecklistItemHistory,
  getVacationPeriods, createVacationPeriod, deleteVacationPeriod, isUserOnVacation,
  notifyUser, getNotifications, markNotificationRead, markAllNotificationsRead,
  logActivity, getDisciplines, getDashboardStats, getWorldMapData, getWeekDeliveries, getMyTasks,
  getAgendaEvents, createAgendaEvent, deleteAgendaEvent,
  getChatMessages, createChatMessage,
  getOrCreateConversation, getDirectMessages, sendDirectMessage, getUserConversations,
  createGroupConversation, getGroupConversations, getConversationMembers, getTasksInVacationPeriod,
  getSprintsByCrs, getSprintChecklistItems, addChecklistItemToSprint, removeChecklistItemFromSprint,
  getSprintWithTasks, addTaskToSprint, removeTaskFromSprint,
  getClientProgress, getCrsDisciplineProgress, getYearlyStats,
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
} from "./db";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import stripe from "stripe";
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
      .input(z.object({ name: z.string().optional(), avatarUrl: z.string().optional(), avatarColor: z.string().optional(), avatarInitials: z.string().max(3).optional() }))
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
      .mutation(async ({ input }) => {
        const { userId, ...data } = input;
        await updateUser(userId, data);
        return { success: true };
      }),
  }),
  // ─── Users ────────────────────────────────────────────────────────────────────────
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
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover sua própria conta." });
        }
        const allUsers = await getAllUsers();
        const targetUser = allUsers.find((u: any) => u.id === input.userId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (targetUser.role === "master_admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "O administrador principal não pode ser removido." });
        }
        await deleteUser(input.userId);
        await logActivity({ userId: ctx.user.id, action: "deleted_user", entityType: "user", entityId: input.userId, metadata: JSON.stringify({ name: targetUser.name ?? targetUser.email }) });
        return { success: true };
      }),
    memberPerformance: protectedProcedure
      .input(z.object({ crsId: z.number().optional() }))
      .query(async ({ input }) => {
        return getMemberPerformance(input.crsId);
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
        tipoObra: z.array(z.enum(["implementacao", "restauracao", "aumento_capacidade", "levantamento", "outro"])).optional(),
        extensaoKm: z.number().optional(),
        areaHa: z.number().optional(),
        perimetroUrbano: z.number().int().optional(),
        techDataByType: z.record(z.string(), z.object({ extensaoKm: z.number().nullable().optional(), areaHa: z.number().nullable().optional() })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const techDataByTypeStr = input.techDataByType ? JSON.stringify(input.techDataByType) : undefined;
        const id = await createCrs({ ...input, tipoObra: input.tipoObra ? JSON.stringify(input.tipoObra) : undefined, techDataByType: techDataByTypeStr, createdById: ctx.user.id });
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
        tipoObra: z.array(z.enum(["implementacao", "restauracao", "aumento_capacidade", "levantamento", "outro"])).nullable().optional(),
        extensaoKm: z.number().nullable().optional(),
        areaHa: z.number().nullable().optional(),
        perimetroUrbano: z.number().int().nullable().optional(),
        techDataByType: z.record(z.string(), z.object({ extensaoKm: z.number().nullable().optional(), areaHa: z.number().nullable().optional() })).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const techDataByTypeStr = data.techDataByType != null ? JSON.stringify(data.techDataByType) : data.techDataByType;
        await updateCrs(id, { ...data, tipoObra: data.tipoObra != null ? JSON.stringify(data.tipoObra) : data.tipoObra, techDataByType: techDataByTypeStr });
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
        const { tasks: t, crs: c, users: u, kanbanPhases: kp, clients: cl } = await import('../drizzle/schema');
        const { eq: eq2, and: and2, like: like2 } = await import('drizzle-orm');
        const db = await getDb();
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
      .query(async ({ input }) => {
        const { crsId, ...filters } = input;
        return getTasksByCrs(crsId, filters);
      }),
    listByCrsWithChecklist: protectedProcedure
      .input(z.object({ crsId: z.number() }))
      .query(async ({ input }) => {
        const taskList = await getTasksByCrs(input.crsId);
        const enriched = await Promise.all(
          taskList.map(async (t: (typeof taskList)[number]) => {
            const checklistItems = await getChecklistItems(t.id);
            return { ...t, checklistItems };
          })
        );
        return enriched;
      }),
    listBlocked: protectedProcedure.query(async () => {
      const db = await getDb();
      const [rows] = await (db as any).$client.query(`
        SELECT t.id, t.title, t.priority, t.blockReason, t.statusChangedAt,
          t.dueDate, t.crsId, t.assigneeId, u.name as assigneeName, c.name as projectName
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigneeId
        LEFT JOIN crs c ON c.id = t.crsId
        WHERE t.status = 'blocked'
        ORDER BY t.statusChangedAt DESC
      `);
      return rows as any[];
    }),
    listWithCounts: protectedProcedure.query(async () => {
      const db = await getDb();
      const allCrs = await getAllCrs();
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
        status: z.enum(["pending", "in_progress", "shared", "published", "archived", "blocked"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const task = await getTaskById(id);
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
      .input(z.object({ id: z.number(), phaseId: z.number(), position: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.phaseId !== task.phaseId) {
          const { kanbanPhases } = await import("../drizzle/schema");
          const { eq: eq2 } = await import("drizzle-orm");
          const dbConn = await getDb();
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
        // Detect @mentions in comment content (e.g., @Nome)
        try {
          const task = await getTaskById(input.taskId);
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
            const allUsers = await getAllUsers();
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
        const sourceTask = await getTaskById(input.id);
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
      .query(async ({ input }) => getCrsDisciplineProgress(input.crsId)),
  }),
  // ─── Dashboard ────────────────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }))
      .query(async ({ input }) => getDashboardStats(input.clientId)),
    worldMap: protectedProcedure.query(async () => getWorldMapData()),
    weekDeliveries: protectedProcedure.query(async () => getWeekDeliveries()),
    myTasks: protectedProcedure.query(async ({ ctx }) => getMyTasks(ctx.user.id)),
    clientProgress: protectedProcedure.query(async () => getClientProgress()),
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
    contractsByState: protectedProcedure.query(async () => {
      const db = await getDb();
      const { crs: crsTable, clients: clientsTable } = await import('../drizzle/schema');
      const { eq: eq2 } = await import('drizzle-orm');
      const rows = await db.select({
        id: crsTable.id, name: crsTable.name,
        stateCode: crsTable.stateCode, state: crsTable.state, progress: crsTable.progress,
        clientName: clientsTable.name,
      }).from(crsTable)
        .leftJoin(clientsTable, eq2(crsTable.clientId, clientsTable.id))
        .where(eq2(crsTable.status, 'active'));
      // Group by stateCode
      const map: Record<string, { state: string; count: number; totalProgress: number; contracts: { id: number; name: string; clientName: string | null; progress: number }[] }> = {};
      rows.forEach((r: any) => {
        const key = r.stateCode ?? r.state ?? 'BR';
        if (!map[key]) map[key] = { state: r.state ?? r.stateCode ?? 'Brasil', count: 0, totalProgress: 0, contracts: [] };
        map[key].count++;
        map[key].totalProgress += r.progress ?? 0;
        map[key].contracts.push({ id: r.id, name: r.name, clientName: r.clientName ?? null, progress: r.progress ?? 0 });
      });
      return Object.entries(map).map(([code, v]) => ({
        code, state: v.state, count: v.count,
        avgProgress: v.count > 0 ? Math.round(v.totalProgress / v.count) : 0,
        contracts: v.contracts,
       })).sort((a, b) => b.count - a.count);
    }),

    // ── SLA / Pontualidade ──────────────────────────────────────────────────
    slaStats: protectedProcedure
      .input(z.object({ period: z.enum(["month", "quarter", "year"]).default("month") }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      const { tasks: t, kanbanPhases: kp, taskPhaseHistory: tph } = await import('../drizzle/schema');
      const { eq: eq2, and: and2, isNotNull: isNotNull2, lte: lte2, sql: sqlExpr2 } = await import('drizzle-orm');
      const period = input?.period ?? "month";
      const now = new Date();
      // Calculate period boundaries
      let thisStart: Date, lastStart: Date, lastEnd: Date;
      if (period === "month") {
        thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
        lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else if (period === "quarter") {
        const q = Math.floor(now.getMonth() / 3);
        thisStart = new Date(now.getFullYear(), q * 3, 1);
        const prevQ = q === 0 ? 3 : q - 1;
        const prevYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
        lastStart = new Date(prevYear, prevQ * 3, 1);
        lastEnd = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
      } else {
        thisStart = new Date(now.getFullYear(), 0, 1);
        lastStart = new Date(now.getFullYear() - 1, 0, 1);
        lastEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      }
      const thisMonthStart = thisStart;
      const lastMonthStart = lastStart;
      const lastMonthEnd = lastEnd;

      // Tasks completed this month (in terminal phases)
      const completedThisMonth = await db.execute(
        sqlExpr2`SELECT COUNT(DISTINCT tph.taskId) as cnt
          FROM task_phase_history tph
          JOIN kanban_phases kp ON kp.id = tph.toPhaseId AND kp.isTerminal = 1
          WHERE tph.changedAt >= ${thisMonthStart}`
      ) as any[];

      // Tasks completed on time this month (completed before or on dueDate)
      const onTimeThisMonth = await db.execute(
        sqlExpr2`SELECT COUNT(DISTINCT tph.taskId) as cnt
          FROM task_phase_history tph
          JOIN kanban_phases kp ON kp.id = tph.toPhaseId AND kp.isTerminal = 1
          JOIN tasks t ON t.id = tph.taskId
          WHERE tph.changedAt >= ${thisMonthStart}
            AND t.dueDate IS NOT NULL
            AND tph.changedAt <= t.dueDate`
      ) as any[];

      // Tasks completed last month
      const completedLastMonth = await db.execute(
        sqlExpr2`SELECT COUNT(DISTINCT tph.taskId) as cnt
          FROM task_phase_history tph
          JOIN kanban_phases kp ON kp.id = tph.toPhaseId AND kp.isTerminal = 1
          WHERE tph.changedAt >= ${lastMonthStart} AND tph.changedAt <= ${lastMonthEnd}`
      ) as any[];

      // Tasks completed on time last month
      const onTimeLastMonth = await db.execute(
        sqlExpr2`SELECT COUNT(DISTINCT tph.taskId) as cnt
          FROM task_phase_history tph
          JOIN kanban_phases kp ON kp.id = tph.toPhaseId AND kp.isTerminal = 1
          JOIN tasks t ON t.id = tph.taskId
          WHERE tph.changedAt >= ${lastMonthStart} AND tph.changedAt <= ${lastMonthEnd}
            AND t.dueDate IS NOT NULL
            AND tph.changedAt <= t.dueDate`
      ) as any[];

      const totalThis = Number((completedThisMonth[0] as any)?.[0]?.cnt ?? 0);
      const onTimeThis = Number((onTimeThisMonth[0] as any)?.[0]?.cnt ?? 0);
      const totalLast = Number((completedLastMonth[0] as any)?.[0]?.cnt ?? 0);
      const onTimeLast = Number((onTimeLastMonth[0] as any)?.[0]?.cnt ?? 0);

      const slaThis = totalThis > 0 ? Math.round((onTimeThis / totalThis) * 100) : null;
      const slaLast = totalLast > 0 ? Math.round((onTimeLast / totalLast) * 100) : null;
      const trend = slaThis !== null && slaLast !== null ? slaThis - slaLast : null;

      return { slaThis, slaLast, trend, totalThis, onTimeThis };
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
      const in3 = new Date(now.getTime() + 3 * 86400000);
      // Buscar tarefas com vencimento nos próximos 3 dias que ainda não foram concluídas
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
            AND t.dueDate <= ${in3}
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
      return { alertsSent: alertCount, tasksChecked: rows.length };
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
      .query(async ({ input }) => {
        const stats = await getDashboardStats();
        const members = await getMemberPerformance(input.crsId);
        const clientProgress = await getClientProgress();
        let disciplineProgress: any[] = [];
        let crsInfo: any = null;
        let tasks: any[] = [];
        if (input.crsId) {
          disciplineProgress = await getCrsDisciplineProgress(input.crsId);
          const allCrs = await getAllCrs();
          crsInfo = allCrs.find((c: any) => c.id === input.crsId) ?? null;
          tasks = await getTasksByCrs(input.crsId);
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
    send: protectedProcedure
      .input(z.object({ conversationId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const id = await sendDirectMessage({ conversationId: input.conversationId, senderId: ctx.user.id, content: input.content });
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
      ];
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.append("client_id", clientId!);
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("scope", scopes.join(" "));
      authUrl.searchParams.append("access_type", "offline");
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
});

export type AppRouter = typeof appRouter;
