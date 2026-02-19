import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  chatMessages,
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
  projectMembers,
  projects,
  taskAttachments,
  taskComments,
  tasks,
  users,
  projectRoles,
  projectMemberRoles,
  InsertProjectRole,
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
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const fields = ["name", "email", "loginMethod", "avatarUrl"] as const;
  for (const f of fields) {
    const v = user[f];
    if (v !== undefined) { values[f] = v ?? null; updateSet[f] = v ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

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

export async function getTasksAssignedToUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.assigneeId, userId)).orderBy(desc(tasks.createdAt)).limit(20);
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
export async function getSetorStats(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const userProjects = await getProjectsByUser(userId);
  const projectIds = userProjects.map(p => p.id);
  if (projectIds.length === 0) return [];
  const rows = await db.select({
    setor: tasks.setor,
    status: tasks.status,
    count: sql<number>`count(*)`,
  })
    .from(tasks)
    .where(inArray(tasks.projectId, projectIds))
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
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0 };

  const userProjects = await getProjectsByUser(userId);
  const projectIds = userProjects.map(p => p.id);

  if (projectIds.length === 0) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0 };

  const taskCounts = await db.select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks).where(inArray(tasks.projectId, projectIds)).groupBy(tasks.status);

  let completedTasks = 0, pendingTasks = 0;
  for (const r of taskCounts) {
    if (r.status === "published" || r.status === "archived") completedTasks += Number(r.count);
    else pendingTasks += Number(r.count);
  }

  return {
    totalProjects: userProjects.length,
    totalTasks: completedTasks + pendingTasks,
    completedTasks,
    pendingTasks,
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

