import AppLayout from "@/components/AppLayout";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Calendar, ZoomIn, ZoomOut, ChevronDown, ChevronRight as ChevronRightIcon, FileDown } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const LEFT_WIDTH = 260; // px — fixed left panel
const ROW_H = 44;       // px per row
const HEADER_H = 56;    // px — date header height (month + day rows)

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:     "#94a3b8",
  in_progress: "#14b8a6",
  shared:      "#f59e0b",
  published:   "#22c55e",
  archived:    "#9ca3af",
  blocked:     "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending:     "Para Iniciar",
  in_progress: "Em Andamento",
  shared:      "Compartilhado",
  published:   "Aprovado",
  archived:    "Arquivado",
  blocked:     "Bloqueado",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function dayStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date) { return Math.round((dayStart(a).getTime() - dayStart(b).getTime()) / 86400000); }
function initials(name: string | null) { return name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"; }

type ViewMode = "project" | "custom";
type ZoomLevel = "day" | "week" | "month";

// ── Component ──────────────────────────────────────────────────────────────────
export default function Gantt() {
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [memberId, setMemberId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [colPx, setColPx] = useState(38); // px per day
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [customEnd, setCustomEnd] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 2); d.setDate(0); return d.toISOString().slice(0, 10); });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);

  const projectsQ = trpc.projects.list.useQuery();
  const ganttQ = trpc.gantt.tasks.useQuery({ projectId });
  const conflictsQ = trpc.gantt.conflicts.useQuery({ projectId });
  const membersQ = trpc.projects.members.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const allTasks = (ganttQ.data ?? []) as any[];
  const tasks = useMemo(() =>
    memberId ? allTasks.filter((t: any) => t.assigneeId === memberId) : allTasks,
    [allTasks, memberId]
  );
  const conflicts = (conflictsQ.data ?? []) as any[];
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((c: any) => [c.task1.id, c.task2.id])), [conflicts]);

  // ── Date range ────────────────────────────────────────────────────────────
  const today = useMemo(() => dayStart(new Date()), []);

  const { rangeStart, totalDays } = useMemo(() => {
    if (viewMode === "custom") {
      const s = dayStart(new Date(customStart));
      const e = dayStart(new Date(customEnd));
      return { rangeStart: s, totalDays: Math.max(1, diffDays(e, s) + 1) };
    }
    // project: fit all task dates
    const dates = tasks.flatMap((t: any) => [
      t.startDate ? new Date(t.startDate) : null,
      t.endDate ? new Date(t.endDate) : null,
      t.dueDate ? new Date(t.dueDate) : null,
    ]).filter(Boolean) as Date[];
    if (dates.length === 0) {
      return { rangeStart: addDays(today, -7), totalDays: 45 };
    }
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    const s = addDays(dayStart(min), -3);
    const e = addDays(dayStart(max), 5);
    return { rangeStart: s, totalDays: Math.max(1, diffDays(e, s) + 1) };
  }, [viewMode, customStart, customEnd, tasks, today]);

  const todayCol = diffDays(today, rangeStart); // column index of today

  // ── Scroll to today on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current && todayCol > 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayCol * colPx - 200);
    }
  }, [todayCol, colPx, rangeStart]);

  // ── Date header data ───────────────────────────────────────────────────────
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)), [rangeStart, totalDays]);

  const months = useMemo(() => {
    const groups: { label: string; colStart: number; count: number }[] = [];
    let cur = "";
    days.forEach((d, i) => {
      const m = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      if (m !== cur) { groups.push({ label: m, colStart: i, count: 1 }); cur = m; }
      else groups[groups.length - 1].count++;
    });
    return groups;
  }, [days]);

  // ── Group tasks by project ─────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { projectName: string; tasks: any[] }>();
    tasks.forEach((t: any) => {
      const key = t.projectName ?? "Sem projeto";
      if (!map.has(key)) map.set(key, { projectName: key, tasks: [] });
      map.get(key)!.tasks.push(t);
    });
    return Array.from(map.values());
  }, [tasks]);

  // ── Bar calculation ────────────────────────────────────────────────────────
  function barProps(task: any): { left: number; width: number; valid: boolean } {
    const s = task.startDate ? dayStart(new Date(task.startDate)) : null;
    const e = task.endDate ? dayStart(new Date(task.endDate)) : task.dueDate ? dayStart(new Date(task.dueDate)) : null;
    if (!s || !e) return { left: 0, width: 0, valid: false };
    const left = diffDays(s, rangeStart) * colPx;
    const width = Math.max(colPx * 0.8, (diffDays(e, s) + 1) * colPx - 4);
    return { left, width, valid: true };
  }

  // ── Render rows ────────────────────────────────────────────────────────────
  const rows: { type: "group"; name: string; key: string } | { type: "task"; task: any; index: number } extends infer R ? R[] : never = [];
  let taskIdx = 0;
  grouped.forEach((g) => {
    (rows as any[]).push({ type: "group", name: g.projectName, key: g.projectName });
    if (!collapsed.has(g.projectName)) {
      g.tasks.forEach((t) => {
        (rows as any[]).push({ type: "task", task: t, index: ++taskIdx });
      });
    }
  });

  const totalGridWidth = totalDays * colPx;

  // ── Export PDF ────────────────────────────────────────────────────────────
  function exportGanttPDF() {
    const YELLOW = "#1561ad";
    const BLACK = "#ffffff";
    const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
    const conflictSet = new Set(conflicts.flatMap((c: any) => [c.task1.id, c.task2.id]));

    const rows = tasks.map((t: any) => {
      const hasConflict = conflictSet.has(t.id);
      const statusLabel = STATUS_LABELS[t.status] ?? t.status;
      const statusColor = STATUS_COLORS[t.status] ?? "#94a3b8";
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-weight:500;max-width:200px">${t.title}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.projectName ?? "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.assigneeName ?? "Não atribuído"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">
          <span style="background:${statusColor}22;color:${statusColor};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600">${statusLabel}</span>
        </td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px">${t.startDate ? new Date(t.startDate).toLocaleDateString("pt-BR") : "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px">${(t.endDate || t.dueDate) ? new Date(t.endDate ?? t.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px">${priorityLabel[t.priority] ?? t.priority}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${hasConflict ? '<span style="color:#ef4444;font-weight:700">⚠ Conflito</span>' : '<span style="color:#22c55e">✔</span>'}</td>
      </tr>`;
    }).join("");

    const conflictRows = conflicts.map((c: any) =>
      `<li style="margin-bottom:4px"><strong>${c.task1.assigneeName ?? "Usuário"}</strong>: “${c.task1.title}” e “${c.task2.title}” se sobrepõem</li>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>@page{size:A4 landscape;margin:15mm}body{font-family:Arial,sans-serif;margin:0;padding:0;color:${BLACK}}</style></head><body>
    <div style="background:${YELLOW};padding:18px 28px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:20px;font-weight:800;color:${BLACK}">Relatório de Gantt</div>
        <div style="font-size:12px;color:${BLACK};opacity:0.7;margin-top:2px">Orbita — LS Solutions</div>
      </div>
      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="LS Solutions">
    </div>
    <div style="padding:20px 28px">
      <div style="font-size:11px;color:#64748b;margin-bottom:16px">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} • ${tasks.length} tarefa(s)</div>
      ${tasks.length === 0
        ? `<div style="text-align:center;padding:40px;color:#64748b">Nenhuma tarefa encontrada para os filtros selecionados.</div>`
        : `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Tarefa</th>
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Projeto</th>
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Responsável</th>
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Status</th>
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Início</th>
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Término</th>
          <th style="padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Prioridade</th>
          <th style="padding:7px 10px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Conflito</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
      ${conflicts.length > 0 ? `<div style="margin-top:20px;background:#fee2e2;border-radius:8px;padding:14px 18px">
        <div style="font-weight:700;color:#ef4444;margin-bottom:8px">⚠ ${conflicts.length} conflito(s) de agenda detectado(s)</div>
        <ul style="margin:0;padding-left:18px;font-size:11px;color:#7f1d1d">${conflictRows}</ul>
      </div>` : ""}
    </div>
    <div style="background:${YELLOW};padding:10px 28px;display:flex;align-items:center;gap:10px;position:fixed;bottom:0;left:0;right:0">
      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="LS Solutions">
      <span style="font-size:11px;font-weight:600;color:${BLACK}">by LS Solutions</span>
      <span style="margin-left:auto;font-size:10px;color:${BLACK};opacity:0.6">© ${new Date().getFullYear()} LS Solutions. Todos os direitos reservados.</span>
    </div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  }

  return (
    <AppLayout title="Gráfico de Gantt">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={projectId?.toString() ?? "all"} onValueChange={v => { setProjectId(v === "all" ? undefined : Number(v)); setMemberId(undefined); }}>
          <SelectTrigger className="w-52 h-9 bg-white border-gray-200 text-sm">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {(projectsQ.data ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Member filter — only shown when a project is selected */}
        {projectId && (
          <Select value={memberId?.toString() ?? "all"} onValueChange={v => setMemberId(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-48 h-9 bg-white border-gray-200 text-sm">
              <SelectValue placeholder="Todos os membros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os membros</SelectItem>
              {(membersQ.data ?? []).map((m: any) => (
                <SelectItem key={m.userId} value={m.userId.toString()}>
                  {m.userName ?? m.userEmail ?? `Membro ${m.userId}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
          <SelectTrigger className="w-48 h-9 bg-white border-gray-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">Período do projeto</SelectItem>
            <SelectItem value="custom">Intervalo personalizado</SelectItem>
          </SelectContent>
        </Select>

        {viewMode === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-36 text-sm" />
            <span className="text-sm text-gray-400">até</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-36 text-sm" />
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setColPx(p => Math.max(18, p - 6))} title="Reduzir zoom">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setColPx(p => Math.min(80, p + 6))} title="Aumentar zoom">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 ml-1" onClick={exportGanttPDF}>
            <FileDown className="w-3.5 h-3.5" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{conflicts.length} conflito(s) de agenda detectado(s):</strong>
            {conflicts.map((c: any, i: number) => (
              <span key={i} className="block text-sm mt-1">
                • <strong>{c.task1.assigneeName ?? "Usuário"}</strong>: "{c.task1.title}" e "{c.task2.title}" se sobrepõem
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Chart */}
      {ganttQ.isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-200 rounded-xl bg-white">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">Nenhuma tarefa encontrada</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Selecione um projeto ou defina datas nas tarefas via Kanban → Editar datas.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm select-none">
          {/* ── Layout: fixed left panel + scrollable right grid ── */}
          <div className="flex" style={{ height: HEADER_H + rows.length * ROW_H }}>

            {/* ── Left panel (fixed width) ── */}
            <div className="flex-shrink-0 border-r border-gray-200 bg-white z-20" style={{ width: LEFT_WIDTH }}>
              {/* Header */}
              <div className="flex flex-col justify-end bg-gray-50 border-b border-gray-200" style={{ height: HEADER_H }}>
                <div className="px-4 py-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome da tarefa</span>
                </div>
              </div>
              {/* Rows */}
              {(rows as any[]).map((row: any, i: number) => {
                if (row.type === "group") {
                  return (
                    <div
                      key={row.key}
                      className="flex items-center gap-2 px-3 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      style={{ height: ROW_H }}
                      onClick={() => setCollapsed(prev => {
                        const next = new Set(prev);
                        next.has(row.key) ? next.delete(row.key) : next.add(row.key);
                        return next;
                      })}
                    >
                      {collapsed.has(row.key)
                        ? <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      }
                      <span className="text-xs font-semibold text-gray-700 truncate">{row.name}</span>
                    </div>
                  );
                }
                const { task, index } = row;
                const isConflict = conflictIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 px-3 border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                    style={{ height: ROW_H }}
                  >
                    <span className="text-[10px] text-gray-400 w-5 flex-shrink-0 text-right">{index}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{task.title}</p>
                      {task.assigneeName && (
                        <p className="text-[10px] text-gray-400 truncate">{task.assigneeName}</p>
                      )}
                    </div>
                    {isConflict && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* ── Right scrollable grid ── */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
              <div style={{ width: totalGridWidth, minWidth: totalGridWidth }}>

                {/* Month header row */}
                <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: 28 }}>
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center border-r border-gray-200 text-xs font-semibold text-gray-600 overflow-hidden"
                      style={{ width: m.count * colPx, minWidth: m.count * colPx }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Day numbers row */}
                <div className="flex border-b border-gray-200" style={{ height: 28 }}>
                  {days.map((d, i) => {
                    const isToday = i === todayCol;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-center text-[11px] font-medium border-r border-gray-100 flex-shrink-0 ${
                          isToday ? "bg-red-50 text-red-600 font-bold" :
                          isWeekend ? "bg-gray-50 text-gray-400" : "text-gray-500"
                        }`}
                        style={{ width: colPx, minWidth: colPx }}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>

                {/* Task grid rows */}
                {(rows as any[]).map((row: any, rowIdx: number) => {
                  if (row.type === "group") {
                    return (
                      <div
                        key={row.key}
                        className="border-b border-gray-200 bg-gray-50/60 relative"
                        style={{ height: ROW_H, width: totalGridWidth }}
                      >
                        {/* Weekend shading */}
                        {days.map((d, i) => d.getDay() === 0 || d.getDay() === 6 ? (
                          <div key={i} className="absolute top-0 bottom-0 bg-gray-100/50" style={{ left: i * colPx, width: colPx }} />
                        ) : null)}
                        {/* Today line */}
                        {todayCol >= 0 && todayCol < totalDays && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: todayCol * colPx + colPx / 2 }} />
                        )}
                      </div>
                    );
                  }

                  const { task } = row;
                  const { left, width, valid } = barProps(task);
                  const isConflict = conflictIds.has(task.id);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < today && task.status !== "published" && task.status !== "archived";
                  const color = isConflict ? "#ef4444" : (STATUS_COLORS[task.status] ?? "#6366f1");

                  return (
                    <div
                      key={task.id}
                      className={`relative border-b border-gray-100 ${rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                      style={{ height: ROW_H, width: totalGridWidth }}
                    >
                      {/* Weekend shading */}
                      {days.map((d, i) => d.getDay() === 0 || d.getDay() === 6 ? (
                        <div key={i} className="absolute top-0 bottom-0 bg-gray-100/40" style={{ left: i * colPx, width: colPx }} />
                      ) : null)}

                      {/* Today line */}
                      {todayCol >= 0 && todayCol < totalDays && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none" style={{ left: todayCol * colPx + colPx / 2 }} />
                      )}

                      {/* Today label (only on first row) */}
                      {rowIdx === 0 && todayCol >= 0 && todayCol < totalDays && (
                        <div
                          className="absolute -top-0 z-20 pointer-events-none"
                          style={{ left: todayCol * colPx + colPx / 2 - 16 }}
                        >
                          <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-sm">Hoje</span>
                        </div>
                      )}

                      {/* Task bar */}
                      {valid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute rounded-md flex items-center overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                              style={{
                                left: left + 2,
                                width: Math.max(8, width - 4),
                                height: 26,
                                top: (ROW_H - 26) / 2,
                                backgroundColor: color,
                                zIndex: 5,
                              }}
                            >
                              {colPx >= 24 && (
                                <span className="text-white text-[11px] font-medium px-2 truncate">
                                  {task.title}
                                </span>
                              )}
                              {isOverdue && <AlertTriangle className="w-3 h-3 text-white mr-1 flex-shrink-0 ml-auto" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs space-y-1">
                            <p className="font-semibold">{task.title}</p>
                            {task.projectName && <p className="text-xs text-muted-foreground">{task.projectName}</p>}
                            {task.assigneeName && <p className="text-xs">Responsável: {task.assigneeName}</p>}
                            {task.startDate && <p className="text-xs">Início: {new Date(task.startDate).toLocaleDateString("pt-BR")}</p>}
                            {task.endDate && <p className="text-xs">Término: {new Date(task.endDate).toLocaleDateString("pt-BR")}</p>}
                            {task.dueDate && <p className={`text-xs ${isOverdue ? "text-red-500 font-semibold" : ""}`}>Vencimento: {new Date(task.dueDate).toLocaleDateString("pt-BR")}</p>}
                            {isConflict && <p className="text-xs text-red-500 font-semibold">⚠️ Conflito de agenda detectado</p>}
                            <Badge className="text-[10px] text-white border-0" style={{ backgroundColor: color }}>
                              {STATUS_LABELS[task.status] ?? task.status}
                            </Badge>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Avatar after bar */}
                      {valid && task.assigneeName && (
                        <div
                          className="absolute z-10"
                          style={{ left: left + width + 6, top: (ROW_H - 22) / 2 }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="w-5 h-5 ring-1 ring-white shadow-sm cursor-default">
                                <AvatarFallback className="text-[8px] font-bold" style={{ backgroundColor: color + "33", color }}>
                                  {initials(task.assigneeName)}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">{task.assigneeName}</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-4 bg-red-400" />
          <span>Hoje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <span>Conflito de agenda</span>
        </div>
      </div>
    </AppLayout>
  );
}
