import { getDb } from "./db";
import { companies, clients, crs, crsSegments, tasks, kanbanPhases, agendaEvents, disciplines, sprints } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

function sanitizeRowsForExcel(rows: any[]) {
  return rows.map((row) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "string" && v.length > 32000) {
        clean[k] = v.substring(0, 31999) + "... [truncado]";
      } else if (v instanceof Date) {
        clean[k] = v.toISOString();
      } else if (v && typeof v === "object") {
        clean[k] = JSON.stringify(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  });
}

export async function getCompanyMigrationSnapshot(companyId?: number | null) {
  const db = await getDb();

  const companyFilter = companyId ? eq(crs.companyId, companyId) : undefined;

  const fetchedCompanies = companyId 
    ? await db.select().from(companies).where(eq(companies.id, companyId))
    : await db.select().from(companies);

  const fetchedClients = await db.select().from(clients);
  const fetchedCrs = companyFilter 
    ? await db.select().from(crs).where(companyFilter)
    : await db.select().from(crs);

  const fetchedSegments = await db.select().from(crsSegments);
  const fetchedTasks = await db.select().from(tasks);
  const fetchedPhases = await db.select().from(kanbanPhases);
  const fetchedAgenda = await db.select().from(agendaEvents);
  const fetchedDisciplines = await db.select().from(disciplines);
  const fetchedSprints = await db.select().from(sprints);

  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    companyId: companyId ?? null,
    data: {
      companies: fetchedCompanies,
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
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: any[]) => {
    const sanitized = sanitizeRowsForExcel(rows);
    const ws = XLSX.utils.json_to_sheet(sanitized.length > 0 ? sanitized : [{ info: "Nenhum registro encontrado" }]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet("Empresas", snapshot.data.companies);
  addSheet("Clientes", snapshot.data.clients);
  addSheet("Contratos-CRS", snapshot.data.crs);
  addSheet("Trechos-KMZ", snapshot.data.crsSegments);
  addSheet("Tarefas-Kanban", snapshot.data.tasks);
  addSheet("Fases-Kanban", snapshot.data.kanbanPhases);
  addSheet("Agenda-Reunioes", snapshot.data.agendaEvents);
  addSheet("Disciplinas", snapshot.data.disciplines);
  addSheet("Sprints", snapshot.data.sprints);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer);
}

export async function importCompanyMigrationJson(jsonString: string, currentCompanyId?: number | null) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || !parsed.data) {
    throw new Error("Arquivo JSON de migração inválido ou corrompido.");
  }

  const db = await getDb();
  const importedCounts = {
    clients: 0,
    crs: 0,
    tasks: 0,
    agendaEvents: 0,
    sprints: 0,
  };

  const snapshotData = parsed.data;

  if (Array.isArray(snapshotData.clients)) {
    for (const c of snapshotData.clients) {
      try {
        await db.insert(clients).values({
          name: c.name,
          description: c.description ?? null,
          crsCode: c.crsCode ?? null,
          color: c.color ?? "#1561ad",
          status: c.status ?? "active",
          createdById: c.createdById ?? 1,
        });
        importedCounts.clients++;
      } catch (e) {}
    }
  }

  if (Array.isArray(snapshotData.crs)) {
    for (const item of snapshotData.crs) {
      try {
        await db.insert(crs).values({
          clientId: item.clientId ?? 1,
          companyId: currentCompanyId ?? item.companyId ?? null,
          name: item.name,
          code: item.code ?? null,
          description: item.description ?? null,
          country: item.country ?? null,
          state: item.state ?? null,
          status: item.status ?? "active",
          progress: item.progress ?? 0,
          tipoObra: item.tipoObra ?? null,
          extensaoKm: item.extensaoKm ?? null,
          areaHa: item.areaHa ?? null,
          perimetroUrbano: item.perimetroUrbano ?? 0,
          createdById: item.createdById ?? 1,
        });
        importedCounts.crs++;
      } catch (e) {}
    }
  }

  if (Array.isArray(snapshotData.tasks)) {
    for (const t of snapshotData.tasks) {
      try {
        await db.insert(tasks).values({
          crsId: t.crsId ?? 1,
          phaseId: t.phaseId ?? 1,
          title: t.title,
          description: t.description ?? null,
          priority: t.priority ?? "medium",
          status: t.status ?? "todo",
          assigneeId: t.assigneeId ?? null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          createdById: t.createdById ?? 1,
        });
        importedCounts.tasks++;
      } catch (e) {}
    }
  }

  return { success: true, importedCounts };
}
