export type GanttReportTask = {
  id: number;
  title: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  dueDate?: Date | string | null;
  assigneeName?: string | null;
  phaseName?: string | null;
  status?: string | null;
  color: string;
  progress?: number | null;
  predecessorId?: number | null;
  milestone?: boolean;
};

export type GanttReportRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "subgroup"; key: string; label: string }
  | { kind: "task"; key: string; label: string; index: number; task: GanttReportTask };

type ReportOptions = {
  title: string;
  generatedAt?: Date;
  logoUrl?: string;
  rows: GanttReportRow[];
  rangeStart?: Date;
  rangeEnd?: Date;
};

type MonthHeader = { label: string; start: number; count: number };

type ReportRange = { start: Date; end: Date; totalDays: number };

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(value: Date, amount: number) {
  const result = new Date(value);
  result.setMonth(result.getMonth() + amount);
  return result;
}

function dayDistance(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function formatDate(value: Date | string | null | undefined) {
  const date = asDate(value);
  return date ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(" de ", "/") : "Sem data";
}

function formatMonth(value: Date) {
  return value.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function buildRange(rows: GanttReportRow[], requestedStart?: Date, requestedEnd?: Date): ReportRange {
  const dates = rows.flatMap((row) => row.kind === "task"
    ? [asDate(row.task.startDate), asDate(row.task.endDate), asDate(row.task.dueDate)].filter(Boolean) as Date[]
    : []);
  const minimum = requestedStart ?? (dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : new Date());
  const maximum = requestedEnd ?? (dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : addMonths(minimum, 3));
  const start = startOfMonth(minimum);
  const end = addMonths(startOfMonth(maximum), 1);
  const totalDays = Math.max(1, dayDistance(start, end));
  return { start, end, totalDays };
}

function buildMonths(range: ReportRange): MonthHeader[] {
  const groups: MonthHeader[] = [];
  for (let index = 0; index < range.totalDays; index += 1) {
    const date = addDays(range.start, index);
    const label = formatMonth(date);
    const current = groups[groups.length - 1];
    if (!current || current.label !== label) groups.push({ label, start: index, count: 1 });
    else current.count += 1;
  }
  return groups;
}

function taskStatus(task: GanttReportTask) {
  if (task.status === "published" || task.status === "archived" || task.phaseName === "Concluído") return "Concluída";
  if (task.dueDate && asDate(task.dueDate)! < startOfDay(new Date())) return "Atrasada";
  return task.phaseName ?? "Em andamento";
}

function taskBar(task: GanttReportTask, range: ReportRange, chartWidth: number) {
  const start = asDate(task.startDate);
  const end = asDate(task.endDate) ?? start;
  if (!start) return null;
  const safeEnd = end && end >= start ? end : start;
  const left = Math.max(0, dayDistance(range.start, start) / range.totalDays * chartWidth);
  const right = Math.min(chartWidth, (dayDistance(range.start, safeEnd) + 1) / range.totalDays * chartWidth);
  const width = Math.max(task.milestone ? 14 : 18, right - left);
  return { left, width, milestone: Boolean(task.milestone) || dayDistance(start, safeEnd) === 0 };
}

function buildMonthHeaders(months: MonthHeader[], chartWidth: number, range: ReportRange) {
  const monthHtml = months.map((month) => `<div class="month-cell" style="width:${month.count / range.totalDays * chartWidth}px">${escapeHtml(month.label)}</div>`).join("");
  const periods: Array<{ label: string; count: number }> = [];
  for (let index = 0; index < months.length; index += 3) {
    periods.push({ label: `P${String(Math.floor(index / 3) + 1).padStart(2, "0")}`, count: months.slice(index, index + 3).reduce((sum, month) => sum + month.count, 0) });
  }
  const periodHtml = periods.map((period) => `<div class="period-cell" style="width:${period.count / range.totalDays * chartWidth}px">${period.label}</div>`).join("");
  return { periodHtml, monthHtml };
}

export function buildVisualGanttReportHtml(options: ReportOptions) {
  const chartWidth = 980;
  const leftWidth = 280;
  const rowHeight = 46;
  const range = buildRange(options.rows, options.rangeStart, options.rangeEnd);
  const months = buildMonths(range);
  const headers = buildMonthHeaders(months, chartWidth, range);
  const taskRows = options.rows.filter((row): row is Extract<GanttReportRow, { kind: "task" }> => row.kind === "task");
  const rowPositions = new Map<number, { y: number; bar: ReturnType<typeof taskBar> }>();
  let visualIndex = 0;
  options.rows.forEach((row) => {
    if (row.kind === "task") {
      rowPositions.set(row.task.id, { y: visualIndex * rowHeight + rowHeight / 2, bar: taskBar(row.task, range, chartWidth) });
    }
    visualIndex += 1;
  });

  const dependencyPaths = taskRows.flatMap((row) => {
    if (!row.task.predecessorId) return [];
    const source = rowPositions.get(row.task.predecessorId);
    const target = rowPositions.get(row.task.id);
    if (!source || !target || !source.bar || !target.bar) return [];
    const sourceX = source.bar.left + source.bar.width;
    const targetX = target.bar.left;
    const bendX = Math.max(sourceX + 12, targetX - 12);
    return [`<path d="M ${sourceX} ${source.y} H ${bendX} V ${target.y} H ${targetX}" />`];
  }).join("");

  const rowsHtml = options.rows.map((row) => {
    if (row.kind === "group") {
      return `<div class="report-row group-row"><div class="row-label"><span class="group-dot"></span><strong>${escapeHtml(row.label)}</strong></div><div class="row-track group-track"></div></div>`;
    }
    if (row.kind === "subgroup") {
      return `<div class="report-row subgroup-row"><div class="row-label"><span class="subgroup-arrow">↳</span><span>${escapeHtml(row.label)}</span></div><div class="row-track"></div></div>`;
    }
    const bar = taskBar(row.task, range, chartWidth);
    const status = taskStatus(row.task);
    const progress = Math.min(100, Math.max(0, Number(row.task.progress ?? 0)));
    const subtitle = `${row.task.assigneeName ?? "Sem responsável"} · ${formatDate(row.task.startDate)} → ${formatDate(row.task.endDate)}`;
    const barHtml = bar?.milestone
      ? `<span class="milestone" style="left:${bar.left}px;background:${escapeHtml(row.task.color)}" title="${escapeHtml(row.task.title)}"></span>`
      : bar
        ? `<span class="task-bar" style="left:${bar.left}px;width:${bar.width}px;background:${escapeHtml(row.task.color)}" title="${escapeHtml(row.task.title)}"><span class="task-progress" style="width:${progress}%"></span><span class="bar-label">${escapeHtml(row.task.title)}</span></span>`
        : `<span class="no-date">Sem datas</span>`;
    return `<div class="report-row task-row"><div class="row-label task-label"><span class="task-number">${row.index}</span><span class="task-copy"><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(subtitle)}</small></span></div><div class="row-track">${barHtml}<span class="status-badge ${status === "Atrasada" ? "late" : status === "Concluída" ? "done" : "active"}">${escapeHtml(status)}</span></div></div>`;
  }).join("");

  const legend = [
    ["#f3bd36", "Planejamento"],
    ["#9fc65c", "Execução"],
    ["#ef8a58", "Revisão"],
    ["#ec5d69", "Risco / atraso"],
    ["#35a8bd", "Entrega"],
  ].map(([color, label]) => `<span class="legend-item"><i style="background:${color}"></i>${label}</span>`).join("");
  const generatedAt = (options.generatedAt ?? new Date()).toLocaleString("pt-BR");
  const logo = options.logoUrl ? `<img src="${escapeHtml(options.logoUrl)}" alt="Órbita" />` : "";
  const chartHeight = Math.max(180, options.rows.length * rowHeight);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title)} — Órbita</title>
<style>
  :root{--navy:#172554;--yellow:#f3bd36;--grid:#dbe4ef;--ink:#1e293b;--muted:#64748b;--chart:${chartWidth}px;--left:${leftWidth}px;--row:${rowHeight}px}
  *{box-sizing:border-box}
  @page{size:landscape;margin:12mm}
  body{margin:0;background:#f7f9fc;color:var(--ink);font-family:Inter,Arial,sans-serif;padding:28px;font-size:12px}
  .report{width:calc(var(--left) + var(--chart));margin:0 auto;background:#fff;border:1px solid #dce4ee;border-radius:16px;padding:26px 28px 20px;box-shadow:0 12px 35px rgba(15,23,42,.08)}
  .report-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:20px}
  .brand{display:flex;align-items:center;gap:12px}.brand img{width:42px;height:42px;object-fit:contain}.eyebrow{margin:0 0 5px;color:var(--yellow);font-weight:800;text-transform:uppercase;letter-spacing:.16em;font-size:10px}.title{margin:0;color:#4b5563;font-size:25px;line-height:1.1}.meta{text-align:right;color:var(--muted);font-size:11px;line-height:1.6}.meta strong{color:var(--navy);font-size:13px}
  .chart-shell{display:grid;grid-template-columns:var(--left) var(--chart);width:calc(var(--left) + var(--chart));overflow:hidden;border:1px solid #dce4ee;border-radius:10px;background:#fff}
  .chart-header{grid-column:1/-1;display:grid;grid-template-columns:var(--left) var(--chart);background:#f8fafc;border-bottom:1px solid var(--grid)}
  .header-label{display:flex;align-items:center;padding:12px 14px;font-weight:800;color:#475569;border-right:1px solid var(--grid);text-transform:uppercase;font-size:10px;letter-spacing:.08em}.header-timeline{width:var(--chart)}
  .periods,.months{display:flex;width:var(--chart);height:28px}.periods{background:#eef3f8;border-bottom:1px solid var(--grid)}.period-cell,.month-cell{display:flex;align-items:center;justify-content:center;border-right:1px solid var(--grid);font-weight:800;text-transform:uppercase;letter-spacing:.08em}.period-cell{font-size:10px;color:#64748b}.month-cell{height:27px;font-size:10px;color:#475569}
  .report-row{grid-column:1/-1;display:grid;grid-template-columns:var(--left) var(--chart);min-height:var(--row);border-bottom:1px solid #edf1f6}.row-label{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 12px;border-right:1px solid var(--grid)}.row-label strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.group-row{background:#edf4ff}.group-dot{width:8px;height:8px;border-radius:50%;background:#2f80ed;flex:none}.subgroup-row{background:#fafcff;color:#64748b}.subgroup-arrow{color:#94a3b8;font-size:14px}.task-label{padding-left:18px}.task-number{display:inline-flex;align-items:center;justify-content:center;flex:none;width:19px;height:19px;border:1px solid #cbd5e1;border-radius:5px;color:#64748b;font-size:10px}.task-copy{display:flex;flex-direction:column;min-width:0;gap:2px}.task-copy strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.task-copy small{font-size:9px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row-track{position:relative;min-width:0;background-image:linear-gradient(to right,rgba(148,163,184,.20) 1px,transparent 1px);background-size:calc(var(--chart) / 12) 100%;background-color:#fff}.group-track{background-color:#edf4ff}.task-bar{position:absolute;top:13px;height:19px;border-radius:999px;min-width:18px;box-shadow:0 2px 4px rgba(15,23,42,.13);overflow:hidden}.task-progress{position:absolute;inset:0 auto 0 0;background:rgba(255,255,255,.33)}.bar-label{position:relative;display:block;max-width:100%;padding:3px 9px;color:#fff;font-weight:800;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.milestone{position:absolute;top:17px;width:14px;height:14px;transform:rotate(45deg);border-radius:2px;box-shadow:0 2px 4px rgba(15,23,42,.15)}.no-date{position:absolute;top:15px;left:10px;color:#94a3b8;font-size:10px;font-style:italic}.status-badge{position:absolute;right:6px;top:4px;font-size:8px;background:rgba(255,255,255,.88);border-radius:999px;padding:2px 5px;color:#64748b}.status-badge.late{color:#b91c1c}.status-badge.done{color:#15803d}.dependency-layer{position:absolute;left:var(--left);top:0;width:var(--chart);height:${chartHeight}px;pointer-events:none;overflow:visible}.dependency-layer path{fill:none;stroke:#94a3b8;stroke-width:1.2;stroke-dasharray:4 4;opacity:.8}.footer{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:18px}.legend{display:flex;flex-wrap:wrap;gap:12px;color:#64748b;font-size:10px}.legend-item{display:inline-flex;align-items:center;gap:5px}.legend-item i{width:11px;height:7px;border-radius:4px;display:inline-block}.footer-note{color:#94a3b8;font-size:10px;text-align:right}
  @media print{body{padding:0;background:#fff}.report{width:calc(var(--left) + var(--chart));margin:0;border:0;box-shadow:none;padding:0}.report-header{margin-top:0}.chart-shell{border-color:#cbd5e1}.task-bar,.milestone{print-color-adjust:exact;-webkit-print-color-adjust:exact}.status-badge{print-color-adjust:exact}}
  @media(max-width:900px){body{padding:12px;overflow-x:auto}.report{margin:0;padding:16px}.report-header{align-items:flex-start}.title{font-size:21px}.meta{font-size:10px}}
</style>
</head>
<body>
  <main class="report">
    <header class="report-header"><div class="brand">${logo}<div><p class="eyebrow">Órbita · Planejamento visual</p><h1 class="title">${escapeHtml(options.title)}</h1></div></div><div class="meta"><strong>${months.length} meses em visão consolidada</strong><br/>Gerado em ${escapeHtml(generatedAt)}<br/>${formatDate(range.start)} → ${formatDate(addDays(range.end, -1))}</div></header>
    <section class="chart-shell" aria-label="Gráfico Gantt visual">
      <div class="chart-header"><div class="header-label">Atividade</div><div class="header-timeline"><div class="periods">${headers.periodHtml}</div><div class="months">${headers.monthHtml}</div></div></div>
      <div style="grid-column:1/-1;position:relative"><div class="dependency-layer"><svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" aria-hidden="true"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>${dependencyPaths.replaceAll(" />", " marker-end=\"url(#arrow)\" />")}</svg></div>${rowsHtml}</div>
    </section>
    <footer class="footer"><div class="legend">${legend}</div><div class="footer-note">Barras mostram o período planejado; o preenchimento interno representa o progresso informado.</div></footer>
  </main>
</body>
</html>`;
}
