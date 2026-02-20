import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  chatMessages,
  companies,
  Company,
  InsertCompany,
  InsertActivityLog,
  InsertChatMessage,
  InsertNotification,
  InsertProject,
  InsertProjectMember,
  InsertTask,
  InsertTaskAttachment,
  InsertTaskComment,
  InsertUser,
  notifications,
  notificationPreferences,
  NOTIFICATION_TYPES,
  NotificationType,
  projectMembers,
  projects,
  taskAttachments,
  taskComments,
  tasks,
  users,
  projectRoles,
  projectMemberRoles,
  InsertProjectRole,
  sprints,
  sprintTasks,
  Sprint,
  InsertSprint,
  agendaEvents,
  AgendaEvent,
  InsertAgendaEvent,
  taskMessages,
  TaskMessage,
  InsertTaskMessage,
  whiteboardData,
  InsertWhiteboardData,
  clients,
  Client,
  InsertClient,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
}
export async function getAllUsers(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(projects).values(data);
  return result.insertId as number;
}

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Projects owned by user OR where user is a member
  const owned = await db.select().from(projects).where(eq(projects.ownerId, userId));
  const memberRows = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers).where(eq(projectMembers.userId, userId));
  const memberIds = memberRows.map(r => r.projectId).filter(id => !owned.find(p => p.id === id));
  if (memberIds.length === 0) return owned;
  const memberProjects = await db.select().from(projects).where(inArray(projects.id, memberIds));
  return [...owned, ...memberProjects];
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return r[0];
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projects).where(eq(projects.id, id));
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

// ─── Project Members ──────────────────────────────────────────────────────────
export async function addProjectMember(data: InsertProjectMember) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(projectMembers).values(data);
}

export async function getProjectMembers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: projectMembers.id,
    projectId: projectMembers.projectId,
    userId: projectMembers.userId,
    role: projectMembers.role,
    invitedAt: projectMembers.invitedAt,
    userName: users.name,
    userEmail: users.email,
    userAvatarUrl: users.avatarUrl,
  }).from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
  return rows;
}

export async function removeProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

export async function isProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const r = await db.select({ id: projectMembers.id }).from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).limit(1);
  return r.length > 0;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Use raw SQL to avoid Drizzle mysql2 enum serialization issues.
  // position uses modulo to stay within INT range (max 2,147,483,647).
  const safePosition = data.position ? data.position % 2000000000 : Date.now() % 2000000000;
  const now = new Date();
  const [result] = await db.execute(
    sql`INSERT INTO tasks (projectId, title, description, status, priority, assigneeId, teamId, createdById, dueDate, position, revisionsCount, setor, openedAt, statusChangedAt)
        VALUES (${data.projectId}, ${data.title}, ${data.description ?? null}, ${data.status ?? 'pending'}, ${data.priority ?? 'medium'}, ${data.assigneeId ?? null}, ${data.teamId ?? null}, ${data.createdById}, ${data.dueDate ?? null}, ${safePosition}, 0, ${(data as any).setor ?? null}, ${now}, ${now})`
  );
  return (result as any).insertId as number;
}

export async function getTasksByProject(
  projectId: number,
  filters?: { status?: string; priority?: string; assigneeId?: number; search?: string }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(tasks.projectId, projectId)];
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority as any));
  if (filters?.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters?.search) conditions.push(like(tasks.title, `%${filters.search}%`));

  const rows = await db.select({
    id: tasks.id,
    projectId: tasks.projectId,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    assigneeId: tasks.assigneeId,
    teamId: tasks.teamId,
    approvedById: tasks.approvedById,
    approvedAt: tasks.approvedAt,
    createdById: tasks.createdById,
    dueDate: tasks.dueDate,
    position: tasks.position,
    revisionsCount: tasks.revisionsCount,
    setor: tasks.setor,
    openedAt: tasks.openedAt,
    completedAt: tasks.completedAt,
    statusChangedAt: tasks.statusChangedAt,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
    assigneeName: users.name,
    assigneeAvatarUrl: users.avatarUrl,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(tasks.position, tasks.createdAt);
  return rows;
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select({
    id: tasks.id,
    projectId: tasks.projectId,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    assigneeId: tasks.assigneeId,
    teamId: tasks.teamId,
    approvedById: tasks.approvedById,
    approvedAt: tasks.approvedAt,
    createdById: tasks.createdById,
    dueDate: tasks.dueDate,
    position: tasks.position,
    revisionsCount: tasks.revisionsCount,
    setor: tasks.setor,
    openedAt: tasks.openedAt,
    completedAt: tasks.completedAt,
    statusChangedAt: tasks.statusChangedAt,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
    assigneeName: users.name,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.id, id)).limit(1);
  return r[0];
}

export async function updateTask(
  id: number,
  data: Partial<InsertTask>,
  options?: { incrementRevisions?: boolean; newStatus?: string; previousStatus?: string }
) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const updateData: Record<string, any> = { ...data, updatedAt: now };
  // Track status change timestamps
  if (options?.newStatus && options.newStatus !== options.previousStatus) {
    updateData.statusChangedAt = now;
    if (options?.newStatus === 'published' || options?.newStatus === 'archived') {
      updateData.completedAt = now;
    } else if ((options?.previousStatus === 'published' || options?.previousStatus === 'archived') && options?.newStatus === 'in_progress') {
      // Returned from published/archived to in_progress: clear completedAt
      updateData.completedAt = null;
    }
  }
  if (options?.incrementRevisions) {
    // Use SQL expression to atomically increment
    await db.execute(
      sql`UPDATE tasks SET revisionsCount = revisionsCount + 1, updatedAt = ${now}
          ${options?.newStatus && options.newStatus !== options.previousStatus ? sql`, statusChangedAt = ${now}` : sql``}
          ${(options?.newStatus === 'published' || options?.newStatus === 'archived') ? sql`, completedAt = ${now}` : sql``}
          ${((options?.previousStatus === 'published' || options?.previousStatus === 'archived') && options?.newStatus === 'in_progress') ? sql`, completedAt = NULL` : sql``}
          WHERE id = ${id}`
    );
    // Then apply the rest of the data fields (excluding status-related already handled)
    const { status, ...restData } = data as any;
    const cleanData: Record<string, any> = { updatedAt: now };
    if (status) cleanData.status = status;
    Object.entries(restData).forEach(([k, v]) => { if (v !== undefined) cleanData[k] = v; });
    if (Object.keys(cleanData).length > 1) {
      await db.update(tasks).set(cleanData).where(eq(tasks.id, id));
    }
    return;
  }
  await db.update(tasks).set(updateData).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function getTasksAssignedToUser(userId: number, filters?: { projectId?: number; setor?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(tasks.assigneeId, userId)];
  if (filters?.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
  if (filters?.setor) conditions.push(eq(tasks.setor, filters.setor));
  return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt)).limit(20);
}

export async function getTaskCountsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return { pending: 0, in_progress: 0, shared: 0, published: 0, archived: 0, total: 0 };
  const rows = await db.select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks).where(eq(tasks.projectId, projectId)).groupBy(tasks.status);
  const counts = { pending: 0, in_progress: 0, shared: 0, published: 0, archived: 0, total: 0 };
  for (const r of rows) {
    const key = r.status as keyof typeof counts;
    if (key in counts) counts[key] = Number(r.count);
    counts.total += Number(r.count);
  }
  return counts;
}

// ─── Task Comments ────────────────────────────────────────────────────────────
export async function createTaskComment(data: InsertTaskComment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(taskComments).values(data);
  return result.insertId as number;
}

export async function getTaskComments(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: taskComments.id,
    taskId: taskComments.taskId,
    userId: taskComments.userId,
    content: taskComments.content,
    createdAt: taskComments.createdAt,
    updatedAt: taskComments.updatedAt,
    userName: users.name,
    userAvatarUrl: users.avatarUrl,
  }).from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);
}

export async function deleteTaskComment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(taskComments).where(eq(taskComments.id, id));
}

// ─── Task Attachments ─────────────────────────────────────────────────────────
export async function createTaskAttachment(data: InsertTaskAttachment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(taskAttachments).values(data);
  return result.insertId as number;
}

export async function getTaskAttachments(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: taskAttachments.id,
    taskId: taskAttachments.taskId,
    uploadedById: taskAttachments.uploadedById,
    filename: taskAttachments.filename,
    fileKey: taskAttachments.fileKey,
    fileUrl: taskAttachments.fileUrl,
    mimeType: taskAttachments.mimeType,
    fileSize: taskAttachments.fileSize,
    createdAt: taskAttachments.createdAt,
    uploaderName: users.name,
  }).from(taskAttachments)
    .leftJoin(users, eq(taskAttachments.uploadedById, users.id))
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(taskAttachments.createdAt);
}

export async function getAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
  return r[0];
}

export async function deleteTaskAttachment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getNotificationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(r[0]?.count ?? 0);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.id, id));
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: activityLogs.id,
    userId: activityLogs.userId,
    action: activityLogs.action,
    entityType: activityLogs.entityType,
    entityId: activityLogs.entityId,
    metadata: activityLogs.metadata,
    createdAt: activityLogs.createdAt,
    userName: users.name,
    userEmail: users.email,
  }).from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit).offset(offset);
}

// ─── Chat Messages ────────────────────────────────────────────────────────────
export async function saveChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(chatMessages).values(data);
  return result.insertId as number;
}

export async function getChatHistory(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(chatMessages.userId, userId)];
  if (projectId) conditions.push(eq(chatMessages.projectId, projectId));
  return db.select().from(chatMessages)
    .where(and(...conditions))
    .orderBy(chatMessages.createdAt)
    .limit(100);
}

export async function clearChatHistory(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return;
  const conditions = [eq(chatMessages.userId, userId)];
  if (projectId) conditions.push(eq(chatMessages.projectId, projectId));
  await db.delete(chatMessages).where(and(...conditions));
}

// ─── Setor Stats ─────────────────────────────────────────────────────────────
export async function getSetorStats(userId: number, filterProjectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const userProjects = await getProjectsByUser(userId);
  const projectIds = userProjects.map(p => p.id);
  if (projectIds.length === 0) return [];
  const filteredIds = filterProjectId ? projectIds.filter(id => id === filterProjectId) : projectIds;
  if (filteredIds.length === 0) return [];
  const rows = await db.select({
    setor: tasks.setor,
    status: tasks.status,
    count: sql<number>`count(*)`,
  })
    .from(tasks)
    .where(inArray(tasks.projectId, filteredIds))
    .groupBy(tasks.setor, tasks.status);
  // Aggregate by setor
  const map = new Map<string, { setor: string; total: number; completed: number; in_progress: number; pending: number; shared: number }>();
  for (const r of rows) {
    const key = r.setor ?? "Sem Setor";
    if (!map.has(key)) map.set(key, { setor: key, total: 0, completed: 0, in_progress: 0, pending: 0, shared: 0 });
    const entry = map.get(key)!;
    const cnt = Number(r.count);
    entry.total += cnt;
    if (r.status === "published" || r.status === "archived") entry.completed += cnt;
    else if (r.status === "in_progress") entry.in_progress += cnt;
    else if (r.status === "shared") entry.shared += cnt;
    else entry.pending += cnt;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(userId: number, filters?: { projectId?: number; setor?: string }) {
  const db = await getDb();
  if (!db) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0, sharedTasks: 0, publishedTasks: 0, archivedTasks: 0, overdueTasks: 0, totalRevisions: 0 };
  const userProjects = await getProjectsByUser(userId);
  const projectIds = userProjects.map(p => p.id);
  if (projectIds.length === 0) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0, sharedTasks: 0, publishedTasks: 0, archivedTasks: 0, overdueTasks: 0, totalRevisions: 0 };

  // Apply project filter
  const filteredProjectIds = filters?.projectId
    ? projectIds.filter(id => id === filters.projectId)
    : projectIds;
  if (filteredProjectIds.length === 0) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0, sharedTasks: 0, publishedTasks: 0, archivedTasks: 0, overdueTasks: 0, totalRevisions: 0 };

  // Build where conditions
  const conditions = [inArray(tasks.projectId, filteredProjectIds)];
  if (filters?.setor) conditions.push(eq(tasks.setor, filters.setor));

  const taskCounts = await db.select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks).where(and(...conditions)).groupBy(tasks.status);

  const revisionsRow = await db.select({ total: sql<number>`COALESCE(SUM(revisionsCount), 0)` })
    .from(tasks).where(and(...conditions));
  const totalRevisions = Number(revisionsRow[0]?.total ?? 0);

  const now = new Date();
  const overdueRows = await db.select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(
      ...conditions,
      sql`${tasks.dueDate} IS NOT NULL`,
      sql`${tasks.dueDate} < ${now}`,
      sql`${tasks.status} NOT IN ('published', 'archived')`
    ));
  const overdueTasks = Number(overdueRows[0]?.count ?? 0);

  let pendingTasks = 0, inProgressTasks = 0, sharedTasks = 0, publishedTasks = 0, archivedTasks = 0;
  for (const r of taskCounts) {
    const cnt = Number(r.count);
    if (r.status === "pending") pendingTasks += cnt;
    else if (r.status === "in_progress") inProgressTasks += cnt;
    else if (r.status === "shared") sharedTasks += cnt;
    else if (r.status === "published") publishedTasks += cnt;
    else if (r.status === "archived") archivedTasks += cnt;
  }
  const completedTasks = publishedTasks + archivedTasks;
  return {
    totalProjects: filters?.projectId ? 1 : userProjects.length,
    totalTasks: pendingTasks + inProgressTasks + sharedTasks + publishedTasks + archivedTasks,
    completedTasks,
    pendingTasks,
    inProgressTasks,
    sharedTasks,
    publishedTasks,
    archivedTasks,
    overdueTasks,
     totalRevisions,
  };
}
// ─── Due-Date Alerts ──────────────────────────────────────────────────────────
/**
 * Returns tasks that are due within the next `windowHours` hours and are not yet done.
 * Used by the background job that sends 24h-before notifications.
 */
export async function getTasksDueSoon(windowHours = 24) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
      projectId: tasks.projectId,
      createdById: tasks.createdById,
    })
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} IS NOT NULL`,
        sql`${tasks.dueDate} > ${now}`,
        sql`${tasks.dueDate} <= ${cutoff}`,
        sql`${tasks.status} NOT IN ('published', 'archived')`
      )
    );
  return rows;
}

// ── Project Roles ─────────────────────────────────────────────────────────────
export async function getProjectRoles(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectRoles).where(eq(projectRoles.projectId, projectId)).orderBy(projectRoles.name);
}

export async function createProjectRole(data: InsertProjectRole) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectRoles).values(data);
}

export async function updateProjectRole(id: number, data: Partial<InsertProjectRole>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectRoles).set(data).where(eq(projectRoles.id, id));
}

export async function deleteProjectRole(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectRoles).where(eq(projectRoles.id, id));
}

export async function getMemberRoles(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    userId: projectMemberRoles.userId,
    roleId: projectMemberRoles.roleId,
    roleName: projectRoles.name,
    isLeader: projectRoles.isLeader,
    canApprove: projectRoles.canApprove,
    color: projectRoles.color,
  })
    .from(projectMemberRoles)
    .leftJoin(projectRoles, eq(projectMemberRoles.roleId, projectRoles.id))
    .where(eq(projectMemberRoles.projectId, projectId));
  return rows;
}

export async function assignMemberRole(projectId: number, userId: number, roleId: number) {
  const db = await getDb();
  if (!db) return;
  // Upsert: delete existing then insert
  await db.delete(projectMemberRoles)
    .where(and(eq(projectMemberRoles.projectId, projectId), eq(projectMemberRoles.userId, userId)));
  await db.insert(projectMemberRoles).values({ projectId, userId, roleId });
}

export async function removeMemberRole(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectMemberRoles)
    .where(and(eq(projectMemberRoles.projectId, projectId), eq(projectMemberRoles.userId, userId)));
}

// --- Notification Preferences ---

/** Returns all preferences for a user, filling defaults for missing types */
export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return NOTIFICATION_TYPES.map((t) => ({ notificationType: t, inApp: true, email: false }));
  const rows = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  // Merge with defaults: any type not yet in DB defaults to inApp=true
  return NOTIFICATION_TYPES.map((t) => {
    const existing = rows.find((r) => r.notificationType === t);
    return existing
      ? { notificationType: t, inApp: existing.inApp, email: false }
      : { notificationType: t, inApp: true, email: false };
  });
}

/** Upsert a single preference for a user */
export async function upsertNotificationPreference(
  userId: number,
  notificationType: string,
  inApp: boolean,
) {
  const db = await getDb();
  if (!db) return;
  // Try update first, then insert
  const existing = await db.select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.notificationType, notificationType),
    ));
  if (existing.length > 0) {
    await db.update(notificationPreferences)
      .set({ inApp })
      .where(and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType),
      ));
  } else {
    await db.insert(notificationPreferences).values({ userId, notificationType, inApp, email: false });
  }
}

/**
 * Smart notification creator: checks user preferences before inserting.
 * If inApp preference is false for this type, skip creation.
 */
export async function notifyUser(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  // Check preference
  const notifType = data.notificationType as string;
  const prefs = await db.select({ inApp: notificationPreferences.inApp })
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.userId, data.userId),
      eq(notificationPreferences.notificationType, notifType),
    ));
  // If preference row exists and inApp is false, skip
  if (prefs.length > 0 && !prefs[0].inApp) return;
  // Otherwise create (default = enabled)
  await db.insert(notifications).values(data);
}


// ─── Companies ────────────────────────────────────────────────────────────────
export async function getAllCompanies(): Promise<Company[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(companies.name);
}
export async function getCompanyById(id: number): Promise<Company | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return r[0];
}
export async function createCompany(data: { name: string; slug: string; color?: string; logoUrl?: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  const r = await db.insert(companies).values(data);
  return Number((r as any)[0]?.insertId ?? 0);
}
export async function updateCompany(id: number, data: Partial<{ name: string; color: string; logoUrl: string }>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(data).where(eq(companies.id, id));
}
export async function deleteCompany(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(companies).where(eq(companies.id, id));
}
export async function getUsersByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.companyId, companyId)).orderBy(users.name);
}
export async function getProjectsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.companyId, companyId)).orderBy(projects.name);
}
export async function updateUserCompany(userId: number, companyId: number | null, role?: "user" | "admin" | "master_admin" | "company_admin"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const update: Record<string, unknown> = { companyId };
  if (role) update.role = role;
  await db.update(users).set(update).where(eq(users.id, userId));
}
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const fields = ["name", "email", "loginMethod", "avatarUrl", "company", "companyId"] as const;
  for (const f of fields) {
    const v = (user as any)[f];
    if (v !== undefined) { (values as any)[f] = v ?? null; updateSet[f] = v ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function deleteUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

// ─── Gantt & Burndown ─────────────────────────────────────────────────────────
export async function getGanttTasks(filters: { projectId?: number; assigneeId?: number; companyId?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      startDate: tasks.startDate,
      endDate: tasks.endDate,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
      projectId: tasks.projectId,
      setor: tasks.setor,
      assigneeName: users.name,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        filters.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
        filters.assigneeId ? eq(tasks.assigneeId, filters.assigneeId) : undefined,
        filters.companyId ? eq(projects.companyId, filters.companyId) : undefined,
      )
    )
    .orderBy(tasks.startDate);
  return rows;
}

export async function getBurndownData(projectId: number) {
  const db = await getDb();
  if (!db) return { total: 0, dataPoints: [] as { date: string; remaining: number; ideal: number }[] };
  // Get all tasks for the project
  const allTasks = await db.select({
    id: tasks.id,
    status: tasks.status,
    completedAt: tasks.completedAt,
    openedAt: tasks.openedAt,
    dueDate: tasks.dueDate,
  }).from(tasks).where(eq(tasks.projectId, projectId));
  if (allTasks.length === 0) return { total: 0, dataPoints: [] };
  const total = allTasks.length;
  // Find project start and end dates
  const projectStart = allTasks.reduce((min, t) => {
    const d = t.openedAt ? new Date(t.openedAt).getTime() : Infinity;
    return d < min ? d : min;
  }, Infinity);
  const projectEnd = allTasks.reduce((max, t) => {
    const d = t.dueDate ? new Date(t.dueDate).getTime() : 0;
    return d > max ? d : max;
  }, 0);
  if (!isFinite(projectStart) || projectEnd === 0) return { total, dataPoints: [] };
  const startDate = new Date(projectStart);
  const endDate = new Date(projectEnd);
  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const dataPoints: { date: string; remaining: number; ideal: number }[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const completed = allTasks.filter(t =>
      t.status === 'published' && t.completedAt && new Date(t.completedAt) <= d
    ).length;
    const remaining = total - completed;
    const ideal = Math.round(total - (total * i / days));
    dataPoints.push({ date: dateStr, remaining, ideal });
  }
  return { total, dataPoints };
}

export async function detectGanttConflicts(projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      startDate: tasks.startDate,
      endDate: tasks.endDate,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(
      and(
        projectId ? eq(tasks.projectId, projectId) : undefined,
        sql`${tasks.startDate} IS NOT NULL`,
        sql`${tasks.endDate} IS NOT NULL`,
      )
    );
  // Find overlapping tasks for same assignee
  const conflicts: { task1: typeof rows[0]; task2: typeof rows[0] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (!a.assigneeId || a.assigneeId !== b.assigneeId) continue;
      if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue;
      const aStart = new Date(a.startDate).getTime();
      const aEnd = new Date(a.endDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      if (aStart < bEnd && aEnd > bStart) {
        conflicts.push({ task1: a, task2: b });
      }
    }
  }
  return conflicts;
}

// ─── Sprints ──────────────────────────────────────────────────────────────────
export async function createSprint(data: InsertSprint) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(sprints).values(data);
  return { id: (result as any).insertId as number };
}

export async function listSprints(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sprints).where(eq(sprints.projectId, projectId)).orderBy(desc(sprints.startDate));
}

export async function getAllSprints() {
  const db = await getDb();
  if (!db) return [];
  const allSprints = await db.select().from(sprints).orderBy(desc(sprints.startDate));
  // Add task counts
  const result = await Promise.all(allSprints.map(async sprint => {
    const stRows = await db!.select({ taskId: sprintTasks.taskId }).from(sprintTasks).where(eq(sprintTasks.sprintId, sprint.id));
    const taskIds = stRows.map(r => r.taskId);
    const taskCount = taskIds.length;
    const completedCount = taskIds.length > 0
      ? (await db!.select({ id: tasks.id }).from(tasks).where(and(inArray(tasks.id, taskIds), eq(tasks.status, 'published')))).length
      : 0;
    return { ...sprint, taskCount, completedCount };
  }));
  return result;
}

export async function getSprintWithTasks(sprintId: number) {
  const db = await getDb();
  if (!db) return null;
  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
  if (!sprint) return null;
  const stRows = await db.select({ taskId: sprintTasks.taskId }).from(sprintTasks).where(eq(sprintTasks.sprintId, sprintId));
  const taskIds = stRows.map(r => r.taskId);
  const sprintTaskList = taskIds.length > 0
    ? await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, assigneeId: tasks.assigneeId, setor: tasks.setor }).from(tasks).where(inArray(tasks.id, taskIds))
    : [];
  return { ...sprint, tasks: sprintTaskList };
}

export async function updateSprint(id: number, data: Partial<InsertSprint>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(sprints).set(data).where(eq(sprints.id, id));
  return { success: true };
}

export async function deleteSprint(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(sprintTasks).where(eq(sprintTasks.sprintId, id));
  await db.delete(sprints).where(eq(sprints.id, id));
  return { success: true };
}

export async function addTaskToSprint(sprintId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(sprintTasks).where(and(eq(sprintTasks.sprintId, sprintId), eq(sprintTasks.taskId, taskId)));
  if (existing.length > 0) return { success: true };
  await db.insert(sprintTasks).values({ sprintId, taskId });
  return { success: true };
}

export async function removeTaskFromSprint(sprintId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(sprintTasks).where(and(eq(sprintTasks.sprintId, sprintId), eq(sprintTasks.taskId, taskId)));
  return { success: true };
}

// ─── Agenda Events ────────────────────────────────────────────────────────────
export async function createAgendaEvent(data: InsertAgendaEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(agendaEvents).values(data);
  return { id: (result as any).insertId as number };
}

export async function listAgendaEvents(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Return events created by user OR public events OR events where user is attendee
  const rows = await db
    .select({
      id: agendaEvents.id,
      createdById: agendaEvents.createdById,
      title: agendaEvents.title,
      type: agendaEvents.type,
      startDate: agendaEvents.startDate,
      endDate: agendaEvents.endDate,
      description: agendaEvents.description,
      meetingUrl: agendaEvents.meetingUrl,
      attendeeIds: agendaEvents.attendeeIds,
      projectId: agendaEvents.projectId,
      isPublic: agendaEvents.isPublic,
      createdAt: agendaEvents.createdAt,
      creatorName: users.name,
    })
    .from(agendaEvents)
    .leftJoin(users, eq(agendaEvents.createdById, users.id))
    .where(
      projectId
        ? or(eq(agendaEvents.createdById, userId), and(eq(agendaEvents.isPublic, true), eq(agendaEvents.projectId, projectId)))
        : or(eq(agendaEvents.createdById, userId), eq(agendaEvents.isPublic, true))
    )
    .orderBy(agendaEvents.startDate);
  return rows;
}

export async function updateAgendaEvent(id: number, data: Partial<InsertAgendaEvent>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(agendaEvents).set(data).where(eq(agendaEvents.id, id));
  return { success: true };
}

export async function deleteAgendaEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(agendaEvents).where(eq(agendaEvents.id, id));
  return { success: true };
}

// ─── Task Messages (Chat entre membros) ──────────────────────────────────────
export async function sendTaskMessage(data: InsertTaskMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(taskMessages).values(data);
  return { id: (result as any).insertId as number };
}

export async function getTaskMessages(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: taskMessages.id,
      taskId: taskMessages.taskId,
      userId: taskMessages.userId,
      message: taskMessages.message,
      createdAt: taskMessages.createdAt,
      userName: users.name,
    })
    .from(taskMessages)
    .leftJoin(users, eq(taskMessages.userId, users.id))
    .where(eq(taskMessages.taskId, taskId))
    .orderBy(taskMessages.createdAt);
}

// ─── Whiteboard ───────────────────────────────────────────────────────────────
export async function getWhiteboard(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(whiteboardData).where(eq(whiteboardData.projectId, projectId));
  return row ?? null;
}

export async function saveWhiteboard(projectId: number, content: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select({ id: whiteboardData.id }).from(whiteboardData).where(eq(whiteboardData.projectId, projectId));
  if (existing.length > 0) {
    await db.update(whiteboardData).set({ content, updatedById: userId }).where(eq(whiteboardData.projectId, projectId));
  } else {
    await db.insert(whiteboardData).values({ projectId, content, updatedById: userId });
  }
  return { success: true };
}


// ─── Clients ──────────────────────────────────────────────────────────────────
export async function createClient(data: { name: string; email?: string; phone?: string; company?: string; notes?: string; companyId?: number; createdById: number }) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(clients).values(data as any);
  return (result as any).insertId as number;
}

export async function listClients(filters: { companyId?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(clients) as any;
  const conditions: any[] = [];
  if (filters.companyId) conditions.push(eq(clients.companyId, filters.companyId));
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(clients.createdAt));
}

export async function updateClient(id: number, data: Partial<{ name: string; email: string; phone: string; company: string; notes: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set(data as any).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(clients).where(eq(clients.id, id));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(clients).where(eq(clients.id, id));
  return row ?? null;
}

export async function countClients(companyId?: number) {
  const db = await getDb();
  if (!db) return 0;
  const conditions: any[] = companyId ? [eq(clients.companyId, companyId)] : [];
  const [row] = await db.select({ count: count() }).from(clients).where(conditions.length > 0 ? and(...conditions) : undefined);
  return row?.count ?? 0;
}
