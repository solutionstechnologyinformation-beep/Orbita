import { and, eq, inArray } from "drizzle-orm";
import { agendaEvents, clients, companies, crs, crsSegments, disciplines, kanbanPhases, sprints, tasks, users } from "../drizzle/schema";
import { getDb } from "./db";
import * as XLSX from "xlsx";

function sanitizeRowsForExcel(rows: any[]) {
  return rows.map((row) => {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && value.length > 32000) clean[key] = `${value.substring(0, 31999)}... [truncado]`;
      else if (value instanceof Date) clean[key] = value.toISOString();
      else if (value && typeof value === "object") clean[key] = JSON.stringify(value);
      else clean[key] = value;
    }
    return clean;
  });
}

function sanitizeUsers(rows: any[]) {
  return rows.map(({ id, openId, name, email, loginMethod, role, company, companyId, createdAt, updatedAt, lastSignedIn }) => ({
    id, openId, name, email, loginMethod, role, company, companyId, createdAt, updatedAt, lastSignedIn,
  }));
}

export async function getCompanyMigrationSnapshot(companyId?: number | null) {
  const db = await getDb();
  const fetchedCompanies = companyId ? await db.select().from(companies).where(eq(companies.id, companyId)) : await db.select().from(companies);
  const tenantUsers = companyId ? await db.select().from(users).where(eq(users.companyId, companyId)) : await db.select().from(users);
  const tenantUserIds = (tenantUsers as any[]).map((user: any) => user.id);

  const fetchedCrs = companyId ? await db.select().from(crs).where(eq(crs.companyId, companyId)) : await db.select().from(crs);
  const crsIds = (fetchedCrs as any[]).map((item: any) => item.id);
  const clientIds = Array.from(new Set((fetchedCrs as any[]).map((item: any) => item.clientId)));

  const fetchedClients = companyId
    ? (clientIds.length ? await db.select().from(clients).where(inArray(clients.id, clientIds)) : [])
    : await db.select().from(clients);
  const fetchedSegments = companyId
    ? (crsIds.length ? await db.select().from(crsSegments).where(inArray(crsSegments.crsId, crsIds)) : [])
    : await db.select().from(crsSegments);
  const fetchedTasks = companyId
    ? (crsIds.length ? await db.select().from(tasks).where(inArray(tasks.crsId, crsIds)) : [])
    : await db.select().from(tasks);
  const fetchedPhases = companyId
    ? (crsIds.length ? await db.select().from(kanbanPhases).where(inArray(kanbanPhases.crsId, crsIds)) : [])
    : await db.select().from(kanbanPhases);
  const fetchedSprints = companyId
    ? (crsIds.length ? await db.select().from(sprints).where(inArray(sprints.crsId, crsIds)) : [])
    : await db.select().from(sprints);
  const fetchedAgenda = companyId
    ? (tenantUserIds.length ? await db.select().from(agendaEvents).where(inArray(agendaEvents.createdById, tenantUserIds)) : [])
    : await db.select().from(agendaEvents);
  const fetchedDisciplines = companyId
    ? (tenantUserIds.length ? await db.select().from(disciplines).where(inArray(disciplines.createdById, tenantUserIds)) : [])
    : await db.select().from(disciplines);

  return {
    version: "1.1.0",
    exportedAt: new Date().toISOString(),
    companyId: companyId ?? null,
    data: {
      companies: fetchedCompanies,
      users: sanitizeUsers(tenantUsers),
      clients: fetchedClients,
      crs: fetchedCrs,
      crsSegments: fetchedSegments,
      tasks: fetchedTasks,
      kanbanPhases: fetchedPhases,
      agendaEvents: fetchedAgenda,
      disciplines: fetchedDisciplines,
      sprints: fetchedSprints,
    },
  };
}

export function generateMigrationExcelBuffer(snapshot: Awaited<ReturnType<typeof getCompanyMigrationSnapshot>>): Buffer {
  const workbook = XLSX.utils.book_new();
  const addSheet = (name: string, rows: any[]) => {
    const sanitized = sanitizeRowsForExcel(rows);
    const worksheet = XLSX.utils.json_to_sheet(sanitized.length ? sanitized : [{ info: "Nenhum registro encontrado" }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  };

  addSheet("Empresas", snapshot.data.companies);
  addSheet("Usuarios", snapshot.data.users);
  addSheet("Clientes", snapshot.data.clients);
  addSheet("Contratos-CRS", snapshot.data.crs);
  addSheet("Trechos-KMZ", snapshot.data.crsSegments);
  addSheet("Tarefas-Kanban", snapshot.data.tasks);
  addSheet("Fases-Kanban", snapshot.data.kanbanPhases);
  addSheet("Agenda-Reunioes", snapshot.data.agendaEvents);
  addSheet("Disciplinas", snapshot.data.disciplines);
  addSheet("Sprints", snapshot.data.sprints);

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export async function importCompanyMigrationJson(jsonString: string, currentCompanyId?: number | null) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || parsed.version === undefined || !parsed.data || typeof parsed.data !== "object") throw new Error("Arquivo JSON de migração inválido ou corrompido.");
  if (parsed.companyId != null && currentCompanyId != null && Number(parsed.companyId) !== Number(currentCompanyId)) throw new Error("O arquivo pertence a outra empresa e não pode ser importado neste ambiente.");

  const db = await getDb();
  const importedCounts = { clients: 0, crs: 0, tasks: 0, agendaEvents: 0, sprints: 0 };
  const data = parsed.data as Record<string, unknown>;

  if (Array.isArray(data.clients)) {
    for (const item of data.clients as any[]) {
      try {
        await db.insert(clients).values({ name: item.name, description: item.description ?? null, crsCode: item.crsCode ?? null, color: item.color ?? "#1561ad", status: item.status ?? "active", createdById: item.createdById ?? 1 });
        importedCounts.clients++;
      } catch {}
    }
  }
  if (Array.isArray(data.crs)) {
    for (const item of data.crs as any[]) {
      try {
        await db.insert(crs).values({ clientId: item.clientId ?? 1, companyId: currentCompanyId ?? item.companyId ?? null, name: item.name, code: item.code ?? null, description: item.description ?? null, country: item.country ?? null, countryCode: item.countryCode ?? null, state: item.state ?? null, stateCode: item.stateCode ?? null, status: item.status ?? "active", progress: item.progress ?? 0, tipoObra: item.tipoObra ?? null, extensaoKm: item.extensaoKm ?? null, areaHa: item.areaHa ?? null, perimetroUrbano: item.perimetroUrbano ?? 0, techDataByType: item.techDataByType ?? null, createdById: item.createdById ?? 1 });
        importedCounts.crs++;
      } catch {}
    }
  }
  if (Array.isArray(data.tasks)) {
    for (const item of data.tasks as any[]) {
      try {
        await db.insert(tasks).values({ crsId: item.crsId ?? 1, phaseId: item.phaseId ?? 1, title: item.title, description: item.description ?? null, priority: item.priority ?? "medium", assigneeId: item.assigneeId ?? null, approvedById: item.approvedById ?? null, approvedAt: item.approvedAt ? new Date(item.approvedAt) : null, createdById: item.createdById ?? 1, startDate: item.startDate ? new Date(item.startDate) : null, endDate: item.endDate ? new Date(item.endDate) : null, dueDate: item.dueDate ? new Date(item.dueDate) : null, position: item.position ?? 0, revisionsCount: item.revisionsCount ?? 0, setor: item.setor ?? null, blockReason: item.blockReason ?? null, openedAt: item.openedAt ? new Date(item.openedAt) : null, completedAt: item.completedAt ? new Date(item.completedAt) : null, statusChangedAt: item.statusChangedAt ? new Date(item.statusChangedAt) : null, progress: item.progress ?? 0 });
        importedCounts.tasks++;
      } catch {}
    }
  }
  return { success: true, importedCounts };
}
