import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import { AlertTriangle, Calendar, ZoomIn, ZoomOut, ChevronDown, ChevronRight as ChevronRightIcon, FileDown, Users, Layers, Filter } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const LEFT_WIDTH = 280; // px — fixed left panel
const ROW_H = 44;       // px per row
const HEADER_H = 56;    // px — date header height (month + day rows)

// ── Helpers ────────────────────────────────────────────────────────────────────
function dayStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date) { return Math.round((dayStart(a).getTime() - dayStart(b).getTime()) / 86400000); }
function initials(name: string | null) { return name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"; }

type GroupMode = "discipline" | "crs" | "user";
type ViewMode = "project" | "custom";
type ZoomLevel = "day" | "week" | "month";

// ── Component ──────────────────────────────────────────────────────────────────
export default function Gantt() {
  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterClientId, setFilterClientId] = useState<number | undefined>(undefined);
  const [filterCrsId, setFilterCrsId] = useState<number | undefined>(undefined);
  const [filterSetor, setFilterSetor] = useState<string | undefined>(undefined);
  const [filterUserId, setFilterUserId] = useState<number | undefined>(undefined);
  const [groupMode, setGroupMode] = useState<GroupMode>("discipline");
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [colPx, setColPx] = useState(38);
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [customEnd, setCustomEnd] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 2); d.setDate(0); return d.toISOString().slice(0, 10); });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Data queries ──────────────────────────────────────────────────────────
  const clientsQ = trpc.clients.list.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const ganttQ = trpc.tasks.listForGantt.useQuery({
    clientId: filterClientId,
    crsId: filterCrsId,
    setor: filterSetor,
    assigneeId: filterUserId,
  });

  const allTasks = (ganttQ.data ?? []) as any[];

  // ── Derived filter options ────────────────────────────────────────────────
  const availableClients = useMemo(() => (clientsQ.data ?? []) as any[], [clientsQ.data]);
  const availableCrs = useMemo(() => {
    const all = (crsQ.data ?? []) as any[];
    return filterClientId ? all.filter((c: any) => c.clientId === filterClientId) : all;
  }, [crsQ.data, filterClientId]);
  const availableSetores = useMemo(() => {
    const s = new Set<string>();
    allTasks.forEach((t: any) => { if (t.setor) s.add(t.setor); });
    return Array.from(s).sort();
  }, [allTasks]);
  const availableUsers = useMemo(() => {
    const seen = new Map<number, string>();
    allTasks.forEach((t: any) => { if (t.assigneeId && t.assigneeName) seen.set(t.assigneeId, t.assigneeName); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTasks]);

  // ── Date range ────────────────────────────────────────────────────────────
  const today = useMemo(() => dayStart(new Date()), []);

  const { rangeStart, totalDays } = useMemo(() => {
    if (viewMode === "custom") {
      const s = dayStart(new Date(customStart));
      const e = dayStart(new Date(customEnd));
      return { rangeStart: s, totalDays: Math.max(1, diffDays(e, s) + 1) };
    }
    const dates = allTasks.flatMap((t: any) => [
      t.startDate ? new Date(t.startDate) : null,
      t.endDate ? new Date(t.endDate) : null,
      t.dueDate ? new Date(t.dueDate) : null,
    ]).filter(Boolean) as Date[];
    if (dates.length === 0) return { rangeStart: addDays(today, -7), totalDays: 45 };
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    const s = addDays(dayStart(min), -3);
    const e = addDays(dayStart(max), 5);
    return { rangeStart: s, totalDays: Math.max(1, diffDays(e, s) + 1) };
  }, [viewMode, customStart, customEnd, allTasks, today]);

  const todayCol = diffDays(today, rangeStart);

  // ── Scroll to today ───────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current && todayCol > 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayCol * colPx - 200);
    }
  }, [todayCol, colPx, rangeStart]);

  // ── Date header data ──────────────────────────────────────────────────────
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

  // ── Group tasks ───────────────────────────────────────────────────────────
  // Default: group by discipline (setor), then sub-group by user
  // Other modes: group by CRS or by user
  const grouped = useMemo(() => {
    if (groupMode === "discipline") {
      // Primary: setor/disciplina → Secondary: user
      const disciplineMap = new Map<string, Map<string, any[]>>();
      allTasks.forEach((t: any) => {
        const disc = t.setor ?? "Sem Disciplina";
        const user = t.assigneeName ?? "Sem Responsável";
        if (!disciplineMap.has(disc)) disciplineMap.set(disc, new Map());
        const userMap = disciplineMap.get(disc)!;
        if (!userMap.has(user)) userMap.set(user, []);
        userMap.get(user)!.push(t);
      });
      return Array.from(disciplineMap.entries()).map(([disc, userMap]) => ({
        groupKey: disc,
        groupLabel: disc,
        subGroups: Array.from(userMap.entries()).map(([user, tasks]) => ({
          subKey: `${disc}::${user}`,
          subLabel: user,
          tasks,
        })),
      }));
    } else if (groupMode === "crs") {
      // Group by CRS
      const map = new Map<string, any[]>();
      allTasks.forEach((t: any) => {
        const key = t.projectName ?? "Sem CRS";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      });
      return Array.from(map.entries()).map(([name, tasks]) => ({
        groupKey: name,
        groupLabel: name,
        subGroups: [{ subKey: name, subLabel: "", tasks }],
      }));
    } else {
      // Group by user
      const map = new Map<string, any[]>();
      allTasks.forEach((t: any) => {
        const key = t.assigneeName ?? "Sem Responsável";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      });
      return Array.from(map.entries()).map(([name, tasks]) => ({
        groupKey: name,
        groupLabel: name,
        subGroups: [{ subKey: name, subLabel: "", tasks }],
      }));
    }
  }, [allTasks, groupMode]);

  // ── Flatten rows ──────────────────────────────────────────────────────────
  type Row =
    | { type: "group"; key: string; label: string }
    | { type: "subgroup"; key: string; label: string; parentKey: string }
    | { type: "task"; task: any; index: number };

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let taskIdx = 0;
    grouped.forEach((g) => {
      result.push({ type: "group", key: g.groupKey, label: g.groupLabel });
      if (!collapsed.has(g.groupKey)) {
        g.subGroups.forEach((sg) => {
          const hasSubLabel = sg.subLabel !== "";
          if (hasSubLabel) {
            result.push({ type: "subgroup", key: sg.subKey, label: sg.subLabel, parentKey: g.groupKey });
          }
          if (!collapsed.has(sg.subKey)) {
            sg.tasks.forEach((t) => {
              result.push({ type: "task", task: t, index: ++taskIdx });
            });
          }
        });
      }
    });
    return result;
  }, [grouped, collapsed]);

  const totalGridWidth = totalDays * colPx;

  // ── Bar calculation ───────────────────────────────────────────────────────
  function barProps(task: any): { left: number; width: number; valid: boolean } {
    const s = task.startDate ? dayStart(new Date(task.startDate)) : null;
    const e = task.endDate ? dayStart(new Date(task.endDate)) : task.dueDate ? dayStart(new Date(task.dueDate)) : null;
    if (!s || !e) return { left: 0, width: 0, valid: false };
    const left = diffDays(s, rangeStart) * colPx;
    const width = Math.max(colPx * 0.8, (diffDays(e, s) + 1) * colPx - 4);
    return { left, width, valid: true };
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  function exportGanttPDF() {
    const BLUE = "#1561ad";
    const WHITE = "#ffffff";
    const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
    const { jsPDF } = (window as any).jspdf ?? {};
    if (!jsPDF) { alert("Biblioteca de PDF não carregada."); return; }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297; const pageH = 210;
    const margin = 12;
    // Header
    doc.setFillColor(BLUE);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(WHITE);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Gráfico de Gantt — Orbita", margin, 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 12, { align: "right" });
    // Table header
    let y = 26;
    doc.setFillColor("#f1f5f9");
    doc.rect(margin, y, pageW - margin * 2, 7, "F");
    doc.setTextColor("#334155");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("#", margin + 2, y + 5);
    doc.text("Tarefa", margin + 10, y + 5);
    doc.text("CRS", margin + 80, y + 5);
    doc.text("Disciplina", margin + 120, y + 5);
    doc.text("Responsável", margin + 155, y + 5);
    doc.text("Início", margin + 195, y + 5);
    doc.text("Término", margin + 220, y + 5);
    doc.text("Fase", margin + 248, y + 5);
    y += 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let idx = 0;
    allTasks.forEach((task: any) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 20;
      }
      idx++;
      if (idx % 2 === 0) { doc.setFillColor("#f8fafc"); doc.rect(margin, y - 1, pageW - margin * 2, 7, "F"); }
      doc.setTextColor("#1e293b");
      doc.text(String(idx), margin + 2, y + 4);
      doc.text((task.title ?? "").slice(0, 38), margin + 10, y + 4);
      doc.text((task.projectName ?? "").slice(0, 22), margin + 80, y + 4);
      doc.text((task.setor ?? "—").slice(0, 18), margin + 120, y + 4);
      doc.text((task.assigneeName ?? "—").slice(0, 18), margin + 155, y + 4);
      doc.text(task.startDate ? new Date(task.startDate).toLocaleDateString("pt-BR") : "—", margin + 195, y + 4);
      doc.text(task.endDate ? new Date(task.endDate).toLocaleDateString("pt-BR") : task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : "—", margin + 220, y + 4);
      doc.text((task.phaseName ?? "—").slice(0, 16), margin + 248, y + 4);
      y += 7;
    });
    // Footer
    doc.setFillColor(BLUE);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(WHITE);
    doc.setFontSize(7);
    doc.text("Orbita — Gestão de Projetos de Infraestrutura", margin, pageH - 4);
    doc.save(`gantt-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <AppLayout title="Gráfico de Gantt">
      {/* ── Toolbar ── */}
      <div className="space-y-3 mb-4">
        {/* Row 1: Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

          {/* Cliente */}
          <Select value={filterClientId?.toString() ?? "_all"} onValueChange={v => {
            setFilterClientId(v === "_all" ? undefined : Number(v));
            setFilterCrsId(undefined);
          }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os clientes</SelectItem>
              {availableClients.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* CRS */}
          <Select value={filterCrsId?.toString() ?? "_all"} onValueChange={v => setFilterCrsId(v === "_all" ? undefined : Number(v))}>
            <SelectTrigger className="w-52 h-9 text-sm">
              <SelectValue placeholder="Todos os CRS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os CRS</SelectItem>
              {availableCrs.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Disciplina/Setor */}
          <Select value={filterSetor ?? "_all"} onValueChange={v => setFilterSetor(v === "_all" ? undefined : v)}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Todas as disciplinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as disciplinas</SelectItem>
              {availableSetores.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Usuário */}
          <Select value={filterUserId?.toString() ?? "_all"} onValueChange={v => setFilterUserId(v === "_all" ? undefined : Number(v))}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os usuários</SelectItem>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Group mode + View + Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Group mode */}
          <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden text-sm">
            {([
              { key: "discipline", label: "Por Disciplina", icon: Layers },
              { key: "crs", label: "Por CRS", icon: Filter },
              { key: "user", label: "Por Usuário", icon: Users },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setGroupMode(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${groupMode === key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* View mode */}
          <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-48 h-9 text-sm">
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
              <span className="text-sm text-muted-foreground">até</span>
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
      </div>

      {/* ── Chart ── */}
      {ganttQ.isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
      ) : allTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-xl bg-card">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">Nenhuma tarefa encontrada</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {filterClientId || filterCrsId || filterSetor || filterUserId
              ? "Tente remover alguns filtros para ver mais tarefas."
              : "Defina datas nas tarefas via Kanban → Editar datas para que apareçam aqui."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm select-none">
          <div className="flex" style={{ height: HEADER_H + rows.length * ROW_H }}>

            {/* ── Left panel ── */}
            <div className="flex-shrink-0 border-r border-border bg-card z-20" style={{ width: LEFT_WIDTH }}>
              <div className="flex flex-col justify-end bg-muted/50 border-b border-border" style={{ height: HEADER_H }}>
                <div className="px-4 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {groupMode === "discipline" ? "Disciplina / Usuário / Tarefa" : groupMode === "crs" ? "CRS / Tarefa" : "Usuário / Tarefa"}
                  </span>
                </div>
              </div>
              {rows.map((row, i) => {
                if (row.type === "group") {
                  return (
                    <div
                      key={row.key}
                      className="flex items-center gap-2 px-3 border-b border-border bg-muted/60 cursor-pointer hover:bg-muted transition-colors"
                      style={{ height: ROW_H }}
                      onClick={() => setCollapsed(prev => {
                        const next = new Set(prev);
                        next.has(row.key) ? next.delete(row.key) : next.add(row.key);
                        return next;
                      })}
                    >
                      {collapsed.has(row.key)
                        ? <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      }
                      <span className="text-xs font-bold text-foreground truncate">{row.label}</span>
                    </div>
                  );
                }
                if (row.type === "subgroup") {
                  return (
                    <div
                      key={row.key}
                      className="flex items-center gap-2 pl-6 pr-3 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ height: ROW_H }}
                      onClick={() => setCollapsed(prev => {
                        const next = new Set(prev);
                        next.has(row.key) ? next.delete(row.key) : next.add(row.key);
                        return next;
                      })}
                    >
                      {collapsed.has(row.key)
                        ? <ChevronRightIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      }
                      <Avatar className="w-5 h-5 flex-shrink-0">
                        <AvatarFallback className="text-[8px] font-bold bg-primary/20 text-primary">{initials(row.label)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-foreground/80 truncate">{row.label}</span>
                    </div>
                  );
                }
                const { task, index } = row;
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 pl-10 pr-3 border-b border-border/50 ${i % 2 === 0 ? "bg-card" : "bg-muted/10"}`}
                    style={{ height: ROW_H }}
                  >
                    <span className="text-[10px] text-muted-foreground w-5 flex-shrink-0 text-right">{index}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                      {groupMode !== "crs" && task.projectName && (
                        <p className="text-[10px] text-muted-foreground truncate">{task.projectName}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Right scrollable grid ── */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
              <div style={{ width: totalGridWidth, minWidth: totalGridWidth }}>

                {/* Month header */}
                <div className="flex border-b border-border bg-muted/50" style={{ height: 28 }}>
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center border-r border-border text-xs font-semibold text-muted-foreground overflow-hidden"
                      style={{ width: m.count * colPx, minWidth: m.count * colPx }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Day numbers */}
                <div className="flex border-b border-border" style={{ height: 28 }}>
                  {days.map((d, i) => {
                    const isToday = i === todayCol;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-center text-[11px] font-medium border-r border-border/50 flex-shrink-0 ${
                          isToday ? "bg-red-50 dark:bg-red-950 text-red-600 font-bold" :
                          isWeekend ? "bg-muted/50 text-muted-foreground/60" : "text-muted-foreground"
                        }`}
                        style={{ width: colPx, minWidth: colPx }}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>

                {/* Task grid rows */}
                {rows.map((row, rowIdx) => {
                  const isGroupRow = row.type === "group" || row.type === "subgroup";
                  return (
                    <div
                      key={row.type === "task" ? row.task.id : row.key}
                      className={`relative border-b ${isGroupRow ? "border-border bg-muted/30" : "border-border/40 " + (rowIdx % 2 === 0 ? "bg-card" : "bg-muted/10")}`}
                      style={{ height: ROW_H, width: totalGridWidth }}
                    >
                      {/* Weekend shading */}
                      {days.map((d, i) => d.getDay() === 0 || d.getDay() === 6 ? (
                        <div key={i} className="absolute top-0 bottom-0 bg-muted/30" style={{ left: i * colPx, width: colPx }} />
                      ) : null)}

                      {/* Today line */}
                      {todayCol >= 0 && todayCol < totalDays && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none" style={{ left: todayCol * colPx + colPx / 2 }} />
                      )}

                      {/* Today label (first row only) */}
                      {rowIdx === 0 && todayCol >= 0 && todayCol < totalDays && (
                        <div className="absolute -top-0 z-20 pointer-events-none" style={{ left: todayCol * colPx + colPx / 2 - 16 }}>
                          <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-sm">Hoje</span>
                        </div>
                      )}

                      {/* Task bar */}
                      {row.type === "task" && (() => {
                        const { task } = row;
                        const { left, width, valid } = barProps(task);
                        const isOverdue = task.dueDate && new Date(task.dueDate) < today && !task.phaseIsTerminal;
                        const color = task.phaseColor ?? "#6366f1";
                        return valid ? (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute rounded-md flex items-center overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                  style={{
                                    left: left + 2, width: Math.max(8, width - 4),
                                    height: 26, top: (ROW_H - 26) / 2,
                                    backgroundColor: color, zIndex: 5,
                                  }}
                                >
                                  {colPx >= 24 && (
                                    <span className="text-white text-[11px] font-medium px-2 truncate">{task.title}</span>
                                  )}
                                  {isOverdue && <AlertTriangle className="w-3 h-3 text-white mr-1 flex-shrink-0 ml-auto" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs space-y-1">
                                <p className="font-semibold">{task.title}</p>
                                {task.projectName && <p className="text-xs text-muted-foreground">{task.projectName}</p>}
                                {task.setor && <p className="text-xs">Disciplina: {task.setor}</p>}
                                {task.assigneeName && <p className="text-xs">Responsável: {task.assigneeName}</p>}
                                {task.startDate && <p className="text-xs">Início: {new Date(task.startDate).toLocaleDateString("pt-BR")}</p>}
                                {task.endDate && <p className="text-xs">Término: {new Date(task.endDate).toLocaleDateString("pt-BR")}</p>}
                                {task.dueDate && <p className={`text-xs ${isOverdue ? "text-red-500 font-semibold" : ""}`}>Vencimento: {new Date(task.dueDate).toLocaleDateString("pt-BR")}</p>}
                                <Badge className="text-[10px] text-white border-0" style={{ backgroundColor: color }}>
                                  {task.phaseName ?? "Sem fase"}
                                </Badge>
                              </TooltipContent>
                            </Tooltip>
                            {task.assigneeName && (
                              <div className="absolute z-10" style={{ left: left + width + 6, top: (ROW_H - 22) / 2 }}>
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
                          </>
                        ) : null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground/40" />
          <span>Cor da barra = cor da fase no Kanban</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-4 bg-red-400" />
          <span>Hoje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <span>Tarefa em atraso</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto text-muted-foreground/60">
          <span>Agrupamento padrão: Disciplina → Usuário → Tarefa</span>
        </div>
      </div>
    </AppLayout>
  );
}
