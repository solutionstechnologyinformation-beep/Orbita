import { useState, useRef, useMemo, useEffect } from "react";
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
  const grouped = useMemo(() => {
    if (groupMode === "discipline") {
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

  // ── Export PDF (HTML Gantt chart) ─────────────────────────────────────────
  function exportGanttPDF() {
    const now = new Date().toLocaleString("pt-BR");
    const BLUE = "#1561ad";
    const dayMs = 86400000;

    // Build date range from tasks
    const dates = allTasks.flatMap((t: any) => [
      t.startDate ? new Date(t.startDate) : null,
      t.endDate ? new Date(t.endDate) : null,
      t.dueDate ? new Date(t.dueDate) : null,
    ]).filter(Boolean) as Date[];
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
    const pdfStart = new Date(minDate); pdfStart.setDate(pdfStart.getDate() - 3);
    const pdfEnd = new Date(maxDate); pdfEnd.setDate(pdfEnd.getDate() + 7);
    const totalPdfDays = Math.max(1, Math.round((pdfEnd.getTime() - pdfStart.getTime()) / dayMs));

    // Build month/week/day header data
    const monthGroups: { label: string; days: number }[] = [];
    let curMonth = "";
    for (let i = 0; i < totalPdfDays; i++) {
      const d = new Date(pdfStart.getTime() + i * dayMs);
      const m = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      if (m !== curMonth) { monthGroups.push({ label: m, days: 1 }); curMonth = m; }
      else monthGroups[monthGroups.length - 1].days++;
    }
    const weekGroups: { label: string; days: number }[] = [];
    let curWeek = -1;
    for (let i = 0; i < totalPdfDays; i++) {
      const d = new Date(pdfStart.getTime() + i * dayMs);
      const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
      const weekKey = d.getFullYear() * 1000 + d.getMonth() * 10 + week;
      if (weekKey !== curWeek) { weekGroups.push({ label: `S${week}`, days: 1 }); curWeek = weekKey; }
      else weekGroups[weekGroups.length - 1].days++;
    }
    // Build rows from grouped data
    const pdfRows: { type: string; label: string; task?: any; depth: number }[] = [];
    grouped.forEach(g => {
      pdfRows.push({ type: "group", label: g.groupLabel, depth: 0 });
      g.subGroups.forEach(sg => {
        if (sg.subLabel) pdfRows.push({ type: "subgroup", label: sg.subLabel, depth: 1 });
        sg.tasks.forEach(t => pdfRows.push({ type: "task", label: t.title ?? "", task: t, depth: sg.subLabel ? 2 : 1 }));
      });
    });

    const COL_W = Math.max(16, Math.min(30, Math.floor(900 / totalPdfDays)));
    const LEFT_W = 280;
    const ROW_H_PDF = 26;
    const totalChartW = totalPdfDays * COL_W;

    const monthCells = monthGroups.map(m =>
      `<td colspan="${m.days}" style="background:#1561ad;color:#fff;font-size:10px;font-weight:700;padding:3px 4px;border-right:1px solid rgba(255,255,255,0.2);white-space:nowrap;overflow:hidden;text-align:center">${m.label}</td>`
    ).join("");

    const weekCells = weekGroups.map(w =>
      `<td colspan="${w.days}" style="background:#1e3a5f;color:#93c5fd;font-size:9px;font-weight:600;padding:2px 4px;border-right:1px solid rgba(255,255,255,0.15);white-space:nowrap;overflow:hidden;text-align:center">${w.label}</td>`
    ).join("");

    // Today offset
    const todayOffset = Math.round((new Date().getTime() - pdfStart.getTime()) / dayMs);

    // Day cells for the third header row (days of month)
    const dayHeaderCells: string[] = [];
    for (let i = 0; i < totalPdfDays; i++) {
      const d = new Date(pdfStart.getTime() + i * dayMs);
      const isToday = i === todayOffset;
      const isSun = d.getDay() === 0;
      const isSat = d.getDay() === 6;
      const bg = isToday ? "#ef4444" : isSun || isSat ? "#253a5a" : "#1e3a5f";
      const color = isToday ? "#fff" : isSun || isSat ? "#64748b" : "#7dd3fc";
      const fw = isToday ? "800" : "400";
      dayHeaderCells.push(`<td style="width:${COL_W}px;min-width:${COL_W}px;background:${bg};color:${color};font-size:8px;font-weight:${fw};text-align:center;padding:1px 0;border-right:1px solid rgba(255,255,255,0.1);white-space:nowrap">${d.getDate()}</td>`);
    }
    const dayCellsRow = dayHeaderCells.join("");

    const taskRowsHtml = pdfRows.map(row => {
      const isGroup = row.type === "group";
      const isSubgroup = row.type === "subgroup";
      const bgColor = isGroup ? "#dbeafe" : isSubgroup ? "#f1f5f9" : "#ffffff";
      const fontWeight = isGroup ? "700" : isSubgroup ? "600" : "400";
      const fontSize = isGroup ? "11" : "10";
      const paddingLeft = row.depth * 12 + 8;

      // Build day cells for the chart
      let dayCells = "";
      for (let i = 0; i < totalPdfDays; i++) {
        const d = new Date(pdfStart.getTime() + i * dayMs);
        const isToday = i === todayOffset;
        const isSun = d.getDay() === 0;
        const isSat = d.getDay() === 6;
        const bg = isToday ? "rgba(239,68,68,0.15)" : isSun || isSat ? "#f8fafc" : "transparent";
        const borderR = isToday ? "2px solid #ef4444" : (i + 1) % 7 === 0 ? "1px solid #cbd5e1" : "1px solid #f1f5f9";
        dayCells += `<td style="width:${COL_W}px;min-width:${COL_W}px;height:${ROW_H_PDF}px;background:${bg};border-right:${borderR};border-bottom:1px solid #e2e8f0;position:relative;padding:0"></td>`;
      }

      // Overlay bar for task rows
      let barOverlay = "";
      if (row.task) {
        const t = row.task;
        const s = t.startDate ? new Date(t.startDate) : null;
        const e = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
        if (s && e) {
          const leftPx = Math.max(0, Math.round((s.getTime() - pdfStart.getTime()) / dayMs) * COL_W);
          const widthPx = Math.max(COL_W, Math.round((e.getTime() - s.getTime()) / dayMs + 1) * COL_W - 2);
          const color = t.phaseColor ?? BLUE;
          barOverlay = `<tr style="height:0"><td style="padding:0;border:none"></td><td colspan="${totalPdfDays}" style="padding:0;border:none;position:relative;height:0">
            <div style="position:absolute;top:-${ROW_H_PDF - 5}px;left:${leftPx}px;width:${widthPx}px;height:16px;background:${color};border-radius:4px;display:flex;align-items:center;padding:0 6px;overflow:hidden;z-index:1">
              <span style="color:#fff;font-size:8px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(t.phaseName ?? "").slice(0, 20)}</span>
            </div>
          </td></tr>`;
        }
      }

      return `<tr style="background:${bgColor}">
        <td style="width:${LEFT_W}px;min-width:${LEFT_W}px;padding:4px 8px 4px ${paddingLeft}px;font-size:${fontSize}px;font-weight:${fontWeight};border-bottom:1px solid #e2e8f0;border-right:2px solid #cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${LEFT_W}px">${row.label.slice(0, 42)}</td>
        ${dayCells}
      </tr>${barOverlay}`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Gantt — Orbita</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
    .page-header { background: ${BLUE}; color: #fff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
    .page-header .title { font-size: 18px; font-weight: 800; }
    .gantt-wrapper { overflow-x: auto; }
    table { border-collapse: collapse; }
    .footer { background: ${BLUE}; color: #fff; padding: 8px 20px; font-size: 10px; display: flex; justify-content: space-between; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .gantt-wrapper { overflow: visible; }
      @page { size: A3 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <div class="title">Gráfico de Gantt — Orbita</div>
      <div style="font-size:11px;opacity:0.8">Gerado em ${now} &nbsp;•&nbsp; ${allTasks.length} atividades</div>
    </div>
    <div style="text-align:right;font-size:11px;opacity:0.8">
      ${new Date(pdfStart).toLocaleDateString("pt-BR")} — ${new Date(pdfEnd).toLocaleDateString("pt-BR")}
    </div>
  </div>
  <div class="gantt-wrapper">
    <table style="width:${LEFT_W + totalChartW}px">
      <thead>
        <tr>
          <td style="width:${LEFT_W}px;min-width:${LEFT_W}px;background:#1561ad;border-right:2px solid #cbd5e1;height:22px"></td>
          ${monthCells}
        </tr>
        <tr>
          <td style="width:${LEFT_W}px;min-width:${LEFT_W}px;background:#1e3a5f;color:#93c5fd;font-size:9px;font-weight:700;padding:2px 8px;border-right:2px solid #cbd5e1">Semana</td>
          ${weekCells}
        </tr>
        <tr>
          <td style="width:${LEFT_W}px;min-width:${LEFT_W}px;background:#1e3a5f;color:#93c5fd;font-size:9px;font-weight:700;padding:2px 8px;border-right:2px solid #cbd5e1;border-bottom:2px solid #334155">Atividade</td>
          ${dayCellsRow}
        </tr>
      </thead>
      <tbody>
        ${taskRowsHtml}
      </tbody>
    </table>
  </div>
  <div class="footer">
    <span>Orbita — Gestão de Projetos de Infraestrutura</span>
    <span>Gerado em ${now}</span>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Popup bloqueado. Permita popups para exportar."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
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

          {/* Disciplina */}
          <Select value={filterSetor ?? "_all"} onValueChange={v => setFilterSetor(v === "_all" ? undefined : v)}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Todas as disciplinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as disciplinas</SelectItem>
              {availableSetores.map((s: string) => (
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
              {availableUsers.map((u: any) => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: View controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Group mode */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["discipline", "crs", "user"] as GroupMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setGroupMode(m)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${groupMode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {m === "discipline" ? "Por Disciplina" : m === "crs" ? "Por CRS" : "Por Usuário"}
              </button>
            ))}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setColPx(p => Math.max(12, p - 6))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{colPx}px</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setColPx(p => Math.min(80, p + 6))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* View mode */}
          <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Período do projeto</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "custom" && (
            <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-xs" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-xs" />
            </>
          )}

          <Button variant="outline" size="sm" className="h-8 gap-1.5 ml-1" onClick={exportGanttPDF}>
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* ── Loading ── */}
      {ganttQ.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      )}

      {/* ── Empty ── */}
      {!ganttQ.isLoading && allTasks.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma tarefa encontrada com os filtros selecionados. Selecione um CRS ou ajuste os filtros.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Gantt Chart ── */}
      {!ganttQ.isLoading && allTasks.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <div className="flex" style={{ height: `${HEADER_H + rows.length * ROW_H}px`, minHeight: 200 }}>
            {/* Left panel */}
            <div className="shrink-0 border-r border-border bg-card z-10" style={{ width: LEFT_WIDTH }}>
              {/* Header */}
              <div className="flex items-end border-b border-border bg-muted/40 px-3" style={{ height: HEADER_H }}>
                <span className="text-xs font-semibold text-muted-foreground pb-2">Atividade</span>
              </div>
              {/* Rows */}
              {rows.map((row, i) => {
                if (row.type === "group") {
                  const isOpen = !collapsed.has(row.key);
                  return (
                    <div
                      key={row.key + i}
                      className="flex items-center gap-1.5 px-2 cursor-pointer select-none bg-primary/8 hover:bg-primary/12 border-b border-border"
                      style={{ height: ROW_H }}
                      onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(row.key) ? n.delete(row.key) : n.add(row.key); return n; })}
                    >
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" /> : <ChevronRightIcon className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <Layers className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-xs font-bold text-primary truncate">{row.label}</span>
                    </div>
                  );
                }
                if (row.type === "subgroup") {
                  const isOpen = !collapsed.has(row.key);
                  return (
                    <div
                      key={row.key + i}
                      className="flex items-center gap-1.5 pl-6 pr-2 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 border-b border-border"
                      style={{ height: ROW_H }}
                      onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(row.key) ? n.delete(row.key) : n.add(row.key); return n; })}
                    >
                      {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRightIcon className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <Avatar className="w-5 h-5 shrink-0">
                        <AvatarFallback className="text-[9px]">{initials(row.label)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold truncate">{row.label}</span>
                    </div>
                  );
                }
                // task row
                const t = row.task;
                return (
                  <div key={t.id + i} className="flex items-center gap-2 pl-10 pr-2 border-b border-border hover:bg-muted/20" style={{ height: ROW_H }}>
                    <span className="text-[10px] text-muted-foreground shrink-0 w-4">{row.index}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs truncate flex-1 cursor-default">{t.title}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-semibold">{t.title}</p>
                        {t.assigneeName && <p className="text-xs text-muted-foreground">Responsável: {t.assigneeName}</p>}
                        {t.phaseName && <p className="text-xs text-muted-foreground">Fase: {t.phaseName}</p>}
                      </TooltipContent>
                    </Tooltip>
                    {t.priority === "urgent" && <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">!</Badge>}
                  </div>
                );
              })}
            </div>

            {/* Scrollable chart area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
              <div style={{ width: totalGridWidth, minWidth: totalGridWidth }}>
                {/* Month header */}
                <div className="flex border-b border-border bg-primary" style={{ height: HEADER_H / 2 }}>
                  {months.map((m, i) => (
                    <div key={i} className="shrink-0 flex items-center justify-center border-r border-primary-foreground/20 text-primary-foreground text-[10px] font-bold px-1 overflow-hidden" style={{ width: m.count * colPx }}>
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Week/day sub-header */}
                <div className="flex border-b border-border bg-[#1e3a5f]" style={{ height: HEADER_H / 2 }}>
                  {days.map((d, i) => {
                    const isSun = d.getDay() === 0;
                    const isToday = diffDays(d, today) === 0;
                    const showLabel = colPx >= 20 ? true : d.getDay() === 1;
                    return (
                      <div
                        key={i}
                        className={`shrink-0 flex items-center justify-center border-r text-[9px] font-medium overflow-hidden ${isToday ? "bg-red-500/30 text-white" : isSun ? "text-blue-300/60" : "text-blue-300/80"} ${isSun ? "border-blue-300/20" : "border-blue-900/40"}`}
                        style={{ width: colPx }}
                      >
                        {showLabel ? d.getDate() : ""}
                      </div>
                    );
                  })}
                </div>
                {/* Task rows */}
                {rows.map((row, i) => {
                  if (row.type === "group") {
                    return (
                      <div key={row.key + i} className="flex bg-primary/5 border-b border-border" style={{ height: ROW_H, width: totalGridWidth }}>
                        {days.map((d, j) => (
                          <div key={j} className={`shrink-0 border-r ${d.getDay() === 0 ? "border-border" : "border-border/30"}`} style={{ width: colPx }} />
                        ))}
                      </div>
                    );
                  }
                  if (row.type === "subgroup") {
                    return (
                      <div key={row.key + i} className="flex bg-muted/20 border-b border-border" style={{ height: ROW_H, width: totalGridWidth }}>
                        {days.map((d, j) => (
                          <div key={j} className={`shrink-0 border-r ${d.getDay() === 0 ? "border-border" : "border-border/30"}`} style={{ width: colPx }} />
                        ))}
                      </div>
                    );
                  }
                  // task row
                  const t = row.task;
                  const bp = barProps(t);
                  const isOverdue = t.dueDate && new Date(t.dueDate) < today && t.phaseName !== "Concluído";
                  return (
                    <div key={t.id + i} className="relative flex border-b border-border hover:bg-muted/10" style={{ height: ROW_H, width: totalGridWidth }}>
                      {/* Grid columns */}
                      {days.map((d, j) => {
                        const isToday2 = diffDays(d, today) === 0;
                        return (
                          <div
                            key={j}
                            className={`shrink-0 border-r ${isToday2 ? "bg-red-500/10" : d.getDay() === 6 || d.getDay() === 0 ? "bg-muted/30" : ""} ${d.getDay() === 0 ? "border-border" : "border-border/30"}`}
                            style={{ width: colPx }}
                          />
                        );
                      })}
                      {/* Today line */}
                      {todayCol >= 0 && todayCol < totalDays && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-10" style={{ left: todayCol * colPx }} />
                      )}
                      {/* Task bar */}
                      {bp.valid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-2.5 rounded-md flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 transition-all shadow-sm"
                              style={{
                                left: bp.left,
                                width: bp.width,
                                height: ROW_H - 20,
                                background: isOverdue ? "#ef4444" : (t.phaseColor ?? "#1561ad"),
                                zIndex: 5,
                              }}
                            >
                              <span className="text-white text-[10px] font-semibold truncate">{t.phaseName ?? ""}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{t.title}</p>
                            <p className="text-xs">{t.startDate ? new Date(t.startDate).toLocaleDateString("pt-BR") : "?"} → {t.endDate ? new Date(t.endDate).toLocaleDateString("pt-BR") : t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "?"}</p>
                            {t.assigneeName && <p className="text-xs text-muted-foreground">{t.assigneeName}</p>}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
