import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  addProjectMember,
  clearChatHistory,
  notifyUser,
  getNotificationPreferences,
  upsertNotificationPreference,
  createProject,
  createTask,
  createTaskAttachment,
  createTaskComment,
  deleteNotification,
  deleteProject,
  deleteTask,
  deleteTaskAttachment,
  deleteTaskComment,
  getActivityLogs,
  getAllProjects,
  getAllUsers,
  getAttachmentById,
  getChatHistory,
  getDashboardStats,
  getNotificationsByUser,
  getProjectById,
  getProjectMembers,
  getProjectsByUser,
  getTaskAttachments,
  getTaskById,
  getTaskComments,
  getTaskCountsByProject,
  getTasksByProject,
  getTasksDueSoon,
  getUnreadNotificationCount,
  logActivity,
  markAllNotificationsRead,
  markNotificationRead,
  removeProjectMember,
  saveChatMessage,
  updateProject,
  updateTask,
  updateUserRole,
  getProjectRoles,
  createProjectRole,
  updateProjectRole,
  deleteProjectRole,
  getMemberRoles,
  assignMemberRole,
  removeMemberRole,
  getTasksAssignedToUser,
  getSetorStats,
} from "./db";

// ─── Admin Guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  return next({ ctx });
});

// ─── Project Access Guard ─────────────────────────────────────────────────────
async function assertProjectAccess(projectId: number, userId: number) {
  const project = await getProjectById(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  if (project.ownerId !== userId) {
    const isMember = await isProjectMemberCheck(projectId, userId);
    if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "No access to this project" });
  }
  return project;
}

async function isProjectMemberCheck(projectId: number, userId: number) {
  const { isProjectMember } = await import("./db");
  return isProjectMember(projectId, userId);
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        setor: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getDashboardStats(ctx.user.id, input ?? {});
      }),
    recentTasks: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        setor: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getTasksAssignedToUser(ctx.user.id, input ?? {});
      }),
    setorStats: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getSetorStats(ctx.user.id, input?.projectId);
      }),
  }),

  // ── Projects ──────────────────────────────────────────────────────────────
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const projs = await getProjectsByUser(ctx.user.id);
      const withCounts = await Promise.all(projs.map(async p => ({
        ...p,
        taskCounts: await getTaskCountsByProject(p.id),
      })));
      return withCounts;
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await assertProjectAccess(input.id, ctx.user.id);
        const members = await getProjectMembers(input.id);
        const taskCounts = await getTaskCountsByProject(input.id);
        return { ...project, members, taskCounts };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        color: z.string().default("#6366f1"),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createProject({ ...input, ownerId: ctx.user.id, status: "active" });
        // Auto-add owner as member with 'owner' role so they appear in member lists
        await addProjectMember({ projectId: id, userId: ctx.user.id, role: "owner" });
        await logActivity({ userId: ctx.user.id, action: "created_project", entityType: "project", entityId: id, metadata: JSON.stringify({ name: input.name }) });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        status: z.enum(["active", "archived", "completed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await assertProjectAccess(id, ctx.user.id);
        await updateProject(id, data);
        await logActivity({ userId: ctx.user.id, action: "updated_project", entityType: "project", entityId: id });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        if (project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await deleteProject(input.id);
        await logActivity({ userId: ctx.user.id, action: "deleted_project", entityType: "project", entityId: input.id });
        return { success: true };
      }),

    addMember: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        await addProjectMember({ projectId: input.projectId, userId: input.userId, role: input.role });
        await notifyUser({
          userId: input.userId,
          title: "Você foi adicionado a um projeto",
          message: `Você foi convidado para colaborar em um projeto.`,
          notificationType: "project_invite",
          relatedProjectId: input.projectId,
        });
        return { success: true };
      }),

    removeMember: protectedProcedure
      .input(z.object({ projectId: z.number(), userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        await removeProjectMember(input.projectId, input.userId);
        return { success: true };
      }),

    members: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        return getProjectMembers(input.projectId);
      }),
  }),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: router({
    list: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assigneeId: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { projectId, ...filters } = input;
        await assertProjectAccess(projectId, ctx.user.id);
        return getTasksByProject(projectId, filters);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(task.projectId, ctx.user.id);
        const [comments, attachments] = await Promise.all([
          getTaskComments(input.id),
          getTaskAttachments(input.id),
        ]);
        return { ...task, comments, attachments };
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        title: z.string().min(1).max(512),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "shared", "published", "archived"]).default("pending"),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assigneeId: z.number().optional(),
        dueDate: z.date().optional(),
        setor: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        const id = await createTask({ ...input, createdById: ctx.user.id, position: Date.now() % 2000000000 } as any);
        await logActivity({ userId: ctx.user.id, action: "created_task", entityType: "task", entityId: id, metadata: JSON.stringify({ title: input.title }) });
        // Notify assignee
        if (input.assigneeId && input.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: input.assigneeId,
            title: "Nova tarefa atribuída a você",
            message: `A tarefa "${input.title}" foi atribuída a você.`,
            notificationType: "task_assigned",
            relatedTaskId: id,
            relatedProjectId: input.projectId,
          });
        }
        // Notify all project members about new task (except creator)
        const members = await getProjectMembers(input.projectId);
        for (const member of members) {
          if (member.userId !== ctx.user.id && member.userId !== (input.assigneeId ?? null)) {
            await notifyUser({
              userId: member.userId,
              title: "Nova tarefa criada",
              message: `Nova tarefa "${input.title}" foi criada no projeto.`,
              notificationType: "task_created",
              relatedTaskId: id,
              relatedProjectId: input.projectId,
            });
          }
        }
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(512).optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "shared", "published", "archived"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assigneeId: z.number().nullable().optional(),
        dueDate: z.date().nullable().optional(),
        position: z.number().optional(),
        setor: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const task = await getTaskById(id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(task.projectId, ctx.user.id);
        const statusChanged = data.status !== undefined && data.status !== task.status;
        // Revision count: ONLY increments when moving from 'shared' back to 'in_progress'
        const shouldIncrementRevision = data.status === 'in_progress' && task.status === 'shared';
        await updateTask(id, data as any, {
          incrementRevisions: shouldIncrementRevision,
          newStatus: data.status,
          previousStatus: task.status,
        });
        await logActivity({
          userId: ctx.user.id,
          action: statusChanged ? `status_changed_to_${data.status}` : "updated_task",
          entityType: "task",
          entityId: id,
          metadata: statusChanged ? JSON.stringify({ from: task.status, to: data.status }) : undefined,
        });
        // Notify assignee if re-assigned
        if (data.assigneeId && data.assigneeId !== task.assigneeId && data.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: data.assigneeId,
            title: "Tarefa atribuída a você",
            message: `A tarefa "${task.title}" foi atribuída a você.`,
            notificationType: "task_assigned",
            relatedTaskId: id,
            relatedProjectId: task.projectId,
          });
        }
        // Notify about status change: notify assignee and creator
        if (statusChanged && data.status) {
          const STATUS_LABELS: Record<string, string> = {
            pending: "Para Iniciar", in_progress: "Em Andamento",
            shared: "Compartilhado", published: "Publicado", archived: "Arquivado",
          };
          const notifyIdsSet = new Set<number>();
          if (task.assigneeId && task.assigneeId !== ctx.user.id) notifyIdsSet.add(task.assigneeId);
          if (task.createdById !== ctx.user.id) notifyIdsSet.add(task.createdById);
          for (const uid of Array.from(notifyIdsSet)) {
            await notifyUser({
              userId: uid,
              title: `Status alterado: ${STATUS_LABELS[data.status] ?? data.status}`,
              message: `A tarefa "${task.title}" mudou de "${STATUS_LABELS[task.status] ?? task.status}" para "${STATUS_LABELS[data.status] ?? data.status}".`,
              notificationType: "task_status_changed",
              relatedTaskId: id,
              relatedProjectId: task.projectId,
            });
          }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(task.projectId, ctx.user.id);
        // Notify assignee about deletion
        if (task.assigneeId && task.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: task.assigneeId,
            title: "Tarefa excluída",
            message: `A tarefa "${task.title}" foi excluída.`,
            notificationType: "task_deleted",
            relatedProjectId: task.projectId,
          });
        }
        await deleteTask(input.id);
        await logActivity({ userId: ctx.user.id, action: "deleted_task", entityType: "task", entityId: input.id });
        return { success: true };
      }),

    // Comments
    addComment: protectedProcedure
      .input(z.object({ taskId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(task.projectId, ctx.user.id);
        const id = await createTaskComment({ taskId: input.taskId, userId: ctx.user.id, content: input.content });
        if (task.assigneeId && task.assigneeId !== ctx.user.id) {
          await notifyUser({
            userId: task.assigneeId,
            title: "Novo comentário na sua tarefa",
            message: `Um comentário foi adicionado na tarefa "${task.title}".`,
            notificationType: "task_comment",
            relatedTaskId: input.taskId,
            relatedProjectId: task.projectId,
          });
        }
        return { id };
      }),

    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTaskComment(input.id);
        return { success: true };
      }),

    // Attachments
    getUploadUrl: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
        fileData: z.string(), // base64
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(task.projectId, ctx.user.id);

        const ext = input.filename.split(".").pop() ?? "bin";
        const fileKey = `attachments/${task.projectId}/${input.taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const buffer = Buffer.from(input.fileData, "base64");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        const attachId = await createTaskAttachment({
          taskId: input.taskId,
          uploadedById: ctx.user.id,
          filename: input.filename,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
        });
        await logActivity({ userId: ctx.user.id, action: "uploaded_attachment", entityType: "task", entityId: input.taskId, metadata: JSON.stringify({ filename: input.filename }) });
        return { id: attachId, url, fileKey };
      }),

    deleteAttachment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const attachment = await getAttachmentById(input.id);
        if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });
        await deleteTaskAttachment(input.id);
        return { success: true };
      }),
  }),

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getNotificationsByUser(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteNotification(input.id);
        return { success: true };
      }),
    // Called by a scheduled job or on-demand to send 24h-before due-date alerts
    checkDueDates: protectedProcedure.mutation(async () => {
      const dueSoon = await getTasksDueSoon(24);
      let sent = 0;
      for (const task of dueSoon) {
        const recipientId = task.assigneeId ?? task.createdById;
        if (!recipientId) continue;
        await notifyUser({
          userId: recipientId,
          title: "Tarefa vence em breve",
          message: `A tarefa "${task.title}" vence em menos de 24 horas.`,
          notificationType: "task_due",
          relatedTaskId: task.id,
          relatedProjectId: task.projectId,
        });
        sent++;
      }
      return { sent };
    }),
  }),

  // ── AI Chat ───────────────────────────────────────────────────────────────
  chat: router({
    history: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return getChatHistory(ctx.user.id, input.projectId);
      }),

    send: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        projectId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await saveChatMessage({ userId: ctx.user.id, projectId: input.projectId ?? null, role: "user", content: input.message });

        // Build context from project data if projectId provided
        let systemContext = `Você é um assistente de gerenciamento de projetos inteligente chamado Orbita AI. 
Você ajuda equipes a organizar tarefas, priorizar trabalho e gerar relatórios de progresso.
Responda sempre em português brasileiro de forma clara e profissional.`;

        if (input.projectId) {
          const project = await getProjectById(input.projectId);
          const taskList = await getTasksByProject(input.projectId);
          const counts = await getTaskCountsByProject(input.projectId);
          if (project) {
            systemContext += `\n\nContexto do Projeto: "${project.name}"
Total de tarefas: ${counts.total}
Para Iniciar: ${counts.pending} | Em Andamento: ${counts.in_progress} | Compartilhado: ${counts.shared} | Publicado: ${counts.published} | Arquivado: ${counts.archived}
Tarefas recentes: ${taskList.slice(0, 10).map(t => `"${t.title}" (${t.status}, prioridade: ${t.priority})`).join(", ")}`;
          }
        }

        const history = await getChatHistory(ctx.user.id, input.projectId);
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemContext },
          ...history.slice(-10).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: input.message },
        ];

        const response = await invokeLLM({ messages });
        const rawContent = response.choices[0]?.message?.content;
        const assistantMessage = typeof rawContent === "string" ? rawContent : "Desculpe, não consegui processar sua mensagem.";

        await saveChatMessage({ userId: ctx.user.id, projectId: input.projectId ?? null, role: "assistant", content: assistantMessage });
        return { message: assistantMessage };
      }),

    generateReport: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await assertProjectAccess(input.projectId, ctx.user.id);
        const tasks = await getTasksByProject(input.projectId);
        const counts = await getTaskCountsByProject(input.projectId);
        const members = await getProjectMembers(input.projectId);
        const completionRate = counts.total > 0 ? Math.round(((counts.published + counts.archived) / counts.total) * 100) : 0;
        // Priority breakdown
        const byPriority = { urgent: 0, high: 0, medium: 0, low: 0 };
        for (const t of tasks) { if (t.priority in byPriority) (byPriority as any)[t.priority]++; }
        // Overdue
        const now = new Date();
        const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== "published" && t.status !== "archived").length;
        const prompt = `Gere um relatório executivo detalhado do projeto "${project.name}":
- Total de tarefas: ${counts.total} (${counts.published + counts.archived} concluídas, ${counts.in_progress} em andamento, ${counts.shared} aguardando aprovação, ${counts.pending} para iniciar)
- Membros da equipe: ${members.length}
- Taxa de conclusão: ${completionRate}%
- Tarefas urgentes: ${byPriority.urgent} | Alta prioridade: ${byPriority.high} | Média: ${byPriority.medium} | Baixa: ${byPriority.low}
- Tarefas em atraso: ${overdue}
Inclua: resumo executivo, análise de progresso, riscos identificados, recomendações e próximos passos.`;
        const response = await invokeLLM({ messages: [
          { role: "system", content: "Você é um especialista em gestão de projetos. Gere relatórios executivos profissionais em português brasileiro." },
          { role: "user", content: prompt },
        ]});
        const reportContent = response.choices[0]?.message?.content;
        return {
          report: typeof reportContent === "string" ? reportContent : "Não foi possível gerar o relatório.",
          chartData: {
            projectName: project.name,
            completionRate,
            counts: { pending: counts.pending, in_progress: counts.in_progress, shared: counts.shared, published: counts.published, archived: counts.archived, total: counts.total },
            byPriority,
            overdue,
            members: members.length,
            generatedAt: new Date().toISOString(),
          },
        };
      }),
    clearHistory: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await clearChatHistory(ctx.user.id, input.projectId);
        return { success: true };
      }),
  }),

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    users: adminProcedure.query(async () => getAllUsers()),
    allProjects: adminProcedure.query(async () => getAllProjects()),
    activityLogs: adminProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => getActivityLogs(input.limit, input.offset)),
    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ── Users (for member search) ─────────────────────────────────────────────
  users: router({
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const all = await getAllUsers(20, 0);
        const q = input.query.toLowerCase();
        return all.filter(u =>
          u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
        ).slice(0, 10);
      }),
  }),

  roles: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        return getProjectRoles(input.projectId);
      }),
    memberRoles: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        return getMemberRoles(input.projectId);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(128),
        isLeader: z.boolean().default(false),
        canApprove: z.boolean().default(false),
        color: z.string().default("#6366f1"),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        await createProjectRole({
          projectId: input.projectId,
          name: input.name,
          isLeader: input.isLeader,
          canApprove: input.canApprove,
          color: input.color,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        projectId: z.number(),
        name: z.string().min(1).max(128).optional(),
        isLeader: z.boolean().optional(),
        canApprove: z.boolean().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        const { id, projectId: _pid, ...data } = input;
        await updateProjectRole(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        await deleteProjectRole(input.id);
        return { success: true };
      }),
    assign: protectedProcedure
      .input(z.object({ projectId: z.number(), userId: z.number(), roleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        await assignMemberRole(input.projectId, input.userId, input.roleId);
        return { success: true };
      }),
    unassign: protectedProcedure
      .input(z.object({ projectId: z.number(), userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(input.projectId, ctx.user.id);
        await removeMemberRole(input.projectId, input.userId);
        return { success: true };
      }),
  }),
  // ── Notification Preferences ──────────────────────────────────────────────
  notificationPreferences: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getNotificationPreferences(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({
        notificationType: z.string(),
        inApp: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertNotificationPreference(ctx.user.id, input.notificationType, input.inApp);
        return { success: true };
      }),
    updateAll: protectedProcedure
      .input(z.object({ inApp: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { NOTIFICATION_TYPES: types } = await import("../drizzle/schema");
        for (const t of types) {
          await upsertNotificationPreference(ctx.user.id, t, input.inApp);
        }
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
