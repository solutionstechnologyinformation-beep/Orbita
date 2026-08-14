import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelContent } from "@/components/SplitLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileDown, BarChart2, Zap, FolderKanban, Loader2, ShieldAlert, Users, Filter, CalendarDays, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ORBITA_LOGO_URL } from "@/branding";
import { REPORT_PALETTE, getReportRateColor } from "./report-palette";

// ─── PDF helpers ───────────────────────────────────────────────────────────────

const BLUE = REPORT_PALETTE.navy;
const YELLOW = REPORT_PALETTE.yellow;
const INK = REPORT_PALETTE.ink;
const WHITE = "#ffffff";

function pdfHeader(title: string, subtitle?: string) {
  return `
    <div style="background:${BLUE};color:${WHITE};padding:28px 36px 20px;border-radius:10px 10px 0 0;border-bottom:4px solid ${YELLOW};">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;border-radius:10px;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:4px;">
          <img src="${ORBITA_LOGO_URL}" alt="Logo Órbita" style="width:100%;height:100%;object-fit:contain;" />
        </div>
        <div>
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:2px;">Órbita — Gerenciamento de Projetos</div>
          <div style="font-size:20px;font-weight:800;color:${WHITE};">${title}</div>
          ${subtitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px;">${subtitle}</div>` : ""}
        </div>
        <div style="margin-left:auto;text-align:right;font-size:11px;color:rgba(255,255,255,0.55);">
          Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>
    </div>`;
}

function pdfFooter() {
  return `
    <div style="margin-top:40px;padding:14px 36px;background:${BLUE};border-top:4px solid ${YELLOW};border-radius:0 0 10px 10px;display:flex;align-items:center;gap:10px;">
      <span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:${WHITE};"><img src="${ORBITA_LOGO_URL}" alt="Logo Órbita" style="width:28px;height:28px;object-fit:contain;background:rgba(255,255,255,0.92);border-radius:5px;padding:2px;" /> Órbita GIS &amp; OS</span>
      <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.55);">Relatório gerado automaticamente</span>
    </div>`;
}

function kpiBox(label: string, value: string | number, color: string = BLUE) {
  return `<div style="background:#ffffff;border-radius:8px;padding:16px 20px;text-align:center;border:1px solid #dbe3ea;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
    <div style="font-size:28px;font-weight:800;color:${color};">${value}</div>
    <div style="font-size:11px;color:#475569;margin-top:4px;">${label}</div>
  </div>`;
}

function openPrint(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up bloqueado. Permita pop-ups para exportar."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,sans-serif;margin:0;padding:24px;background:#f7f8fa;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
      table{border-collapse:collapse;width:100%;}
      th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #dbe3ea;font-size:12px;}
      th{background:#eef2f7;font-weight:700;color:#0f172a;}
      @media print{body{padding:0;background:#fff;}button{display:none!important;}}
    </style></head><body>
    <div style="max-width:960px;margin:0 auto;">
      ${html}
      <div style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="background:${YELLOW};color:${INK};border:none;padding:10px 28px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">Imprimir / Salvar PDF</button>
      </div>
    </div></body></html>`);
  w.document.close();
}

// ─── Bar chart SVG helper ─────────────────────────────────────────────────────
function barChartSvg(items: { label: string; value: number; color: string }[], maxVal: number, width = 820, barH = 22, gap = 8) {
  const labelW = 180;
  const barAreaW = width - labelW - 70;
  const rowH = barH + gap;
  const svgH = items.length * rowH + 10;
  const rows = items.map((item, i) => {
    const barW = maxVal > 0 ? Math.round((item.value / maxVal) * barAreaW) : 0;
    const y = i * rowH + 4;
    return `
      <text x="0" y="${y + barH - 5}" font-size="11" fill="#334155" font-family="Inter,sans-serif">${item.label.length > 22 ? item.label.slice(0, 22) + "…" : item.label}</text>
      <rect x="${labelW}" y="${y}" width="${Math.max(barW, 2)}" height="${barH}" rx="4" fill="${item.color}" opacity="0.85"/>
      <text x="${labelW + barW + 6}" y="${y + barH - 5}" font-size="11" fill="#0f3b5f" font-weight="700" font-family="Inter,sans-serif">${item.value}%</text>`;
  }).join("");
  return `<svg width="${width}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

// ─── Burndown SVG helper ──────────────────────────────────────────────────────
function burndownSvg(dataPoints: { date: string; remaining: number; ideal: number }[], totalTasks: number, width = 820, height = 200) {
  if (!dataPoints || dataPoints.length < 2) return "<p style='color:#94a3b8;font-size:12px;'>Dados insuficientes para o burndown.</p>";
  const padL = 40, padR = 20, padT = 16, padB = 36;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const n = dataPoints.length;
  const xScale = (i: number) => padL + (i / (n - 1)) * w;
  const yScale = (v: number) => padT + h - (v / Math.max(totalTasks, 1)) * h;

  // Ideal line
  const idealPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(p.ideal).toFixed(1)}`).join(" ");
  // Remaining line
  const remainPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(p.remaining).toFixed(1)}`).join(" ");

  // X axis labels (show ~5 evenly spaced)
  const step = Math.max(1, Math.floor((n - 1) / 4));
  const xLabels = dataPoints
    .filter((_, i) => i % step === 0 || i === n - 1)
    .map((p, idx, arr) => {
      const origIdx = dataPoints.indexOf(p);
      const x = xScale(origIdx);
      const label = new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `<text x="${x.toFixed(1)}" y="${(padT + h + 18).toFixed(1)}" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">${label}</text>`;
    }).join("");

  // Y axis labels
  const yLabels = [0, Math.round(totalTasks / 2), totalTasks].map(v =>
    `<text x="${(padL - 6).toFixed(1)}" y="${yScale(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">${v}</text>`
  ).join("");

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Grid lines -->
    ${[0, Math.round(totalTasks / 2), totalTasks].map(v =>
      `<line x1="${padL}" y1="${yScale(v).toFixed(1)}" x2="${padL + w}" y2="${yScale(v).toFixed(1)}" stroke="#dbe3ea" stroke-width="1"/>`
    ).join("")}
    <!-- Ideal line (dashed) -->
    <path d="${idealPath}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6,4" fill="none"/>
    <!-- Remaining line -->
    <path d="${remainPath}" stroke="#2563eb" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <!-- Axes -->
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + h}" stroke="#b8c4d0" stroke-width="1"/>
    <line x1="${padL}" y1="${padT + h}" x2="${padL + w}" y2="${padT + h}" stroke="#b8c4d0" stroke-width="1"/>
    ${xLabels}
    ${yLabels}
    <!-- Legend -->
    <rect x="${padL + w - 180}" y="${padT}" width="12" height="3" rx="1" fill="#94a3b8"/>
    <text x="${padL + w - 164}" y="${padT + 7}" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">Ideal</text>
    <rect x="${padL + w - 110}" y="${padT}" width="12" height="3" rx="1" fill="#0f3b5f"/>
    <text x="${padL + w - 94}" y="${padT + 7}" font-size="10" fill="#0f3b5f" font-family="Inter,sans-serif">Real</text>
  </svg>`;
}

// ─── Dashboard Report ─────────────────────────────────────────────────────────
function exportDashboardReport(projects: any[], stats: any, sprints: any[], clientName?: string) {
  const total = projects.reduce((s: number, p: any) => s + (p.taskCounts?.total ?? 0), 0);
  const done = projects.reduce((s: number, p: any) => s + (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0), 0);
  const inprog = projects.reduce((s: number, p: any) => s + (p.taskCounts?.inProgress ?? 0), 0);
  const blocked = projects.reduce((s: number, p: any) => s + (p.taskCounts?.blocked ?? 0), 0);
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const projectRows = projects.map((p: any) => {
    const t = p.taskCounts?.total ?? 0;
    const d = (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0);
    const rate = t > 0 ? Math.round((d / t) * 100) : 0;
    return `<tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color ?? BLUE};margin-right:8px;"></span>${p.name}</td>
      <td>${p.status ?? "—"}</td>
      <td>${t}</td>
      <td>${d}</td>
      <td><span style="background:${rate >= 80 ? "#dcfce7" : rate >= 50 ? "#fef9c3" : "#fee2e2"};color:${rate >= 80 ? "#166534" : rate >= 50 ? "#854d0e" : "#991b1b"};padding:2px 8px;border-radius:12px;font-size:11px;">${rate}%</span></td>
    </tr>`;
  }).join("");

  const html = `
    ${pdfHeader("Relatório do Dashboard", clientName ? `Cliente: ${clientName}` : "Visão geral de projetos e tarefas")}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        ${kpiBox("Projetos", projects.length)}
        ${kpiBox("Total de Tarefas", total)}
        ${kpiBox("Concluídas", done, "#16a34a")}
        ${kpiBox("Taxa de Conclusão", completionRate + "%", completionRate >= 70 ? "#16a34a" : "#dc2626")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${kpiBox("Em Andamento", inprog, "#2563eb")}
        ${kpiBox("Bloqueadas", blocked, "#dc2626")}
        ${kpiBox("Sprints Ativas", sprints.filter((s: any) => s.status === "active").length, "#0f172a")}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Projetos</h3>
      <table>
        <thead><tr><th>Projeto</th><th>Status</th><th>Total</th><th>Concluídas</th><th>Taxa</th></tr></thead>
        <tbody>${projectRows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Relatório do Dashboard");
}

// ─── Projects Report (with bar chart) ────────────────────────────────────────
function exportProjectsReport(projects: any[], clients: any[], clientName?: string) {
  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));

  // Build bar chart data
  const chartItems = projects.map((p: any) => {
    const t = p.taskCounts?.total ?? 0;
    const d = (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0);
    const rate = t > 0 ? Math.round((d / t) * 100) : 0;
    return {
      label: p.name,
      value: rate,
      color: getReportRateColor(rate),
    };
  }).sort((a, b) => b.value - a.value);

  const rows = projects.map((p: any) => {
    const t = p.taskCounts?.total ?? 0;
    const d = (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0);
    const ip = p.taskCounts?.inProgress ?? 0;
    const bl = p.taskCounts?.blocked ?? 0;
    const rate = t > 0 ? Math.round((d / t) * 100) : 0;
    return `<tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color ?? BLUE};margin-right:8px;"></span>${p.name}</td>
      <td>${clientMap[p.clientId] ?? "—"}</td>
      <td>${p.status ?? "—"}</td>
      <td style="text-align:center">${t}</td>
      <td style="text-align:center;color:#16a34a;font-weight:600">${d}</td>
      <td style="text-align:center;color:#2563eb">${ip}</td>
      <td style="text-align:center;color:#ef4444">${bl}</td>
      <td><span style="background:${rate >= 80 ? "#dcfce7" : rate >= 50 ? "#fef9c3" : "#fee2e2"};color:${rate >= 80 ? "#166534" : rate >= 50 ? "#854d0e" : "#991b1b"};padding:2px 8px;border-radius:12px;font-size:11px;">${rate}%</span></td>
    </tr>`;
  }).join("");

  const totalTasks = projects.reduce((s: number, p: any) => s + (p.taskCounts?.total ?? 0), 0);
  const totalDone = projects.reduce((s: number, p: any) => s + (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0), 0);
  const avgRate = projects.length > 0
    ? Math.round(chartItems.reduce((s, c) => s + c.value, 0) / projects.length)
    : 0;

  const html = `
    ${pdfHeader("Relatório de Projetos", clientName ? `Cliente: ${clientName}` : `${projects.length} projetos cadastrados`)}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
        ${kpiBox("Projetos", projects.length)}
        ${kpiBox("Total de Tarefas", totalTasks)}
        ${kpiBox("Concluídas", totalDone, "#16a34a")}
        ${kpiBox("Taxa Média", avgRate + "%", avgRate >= 70 ? "#16a34a" : "#dc2626")}
      </div>

      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:16px;">Taxa de Conclusão por Projeto</h3>
      <div style="background:#ffffff;border-radius:10px;padding:20px 16px;border:1px solid #dbe3ea;margin-bottom:28px;overflow-x:auto;">
        ${barChartSvg(chartItems, 100)}
      </div>

      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Detalhamento por Projeto</h3>
      <table>
        <thead>
          <tr>
            <th>Projeto</th><th>Cliente</th><th>Status</th>
            <th style="text-align:center">Total</th><th style="text-align:center">Concluídas</th>
            <th style="text-align:center">Andamento</th><th style="text-align:center">Bloqueadas</th>
            <th>Taxa</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Relatório de Projetos");
}

// ─── Sprint Report (with burndown) ────────────────────────────────────────────
function exportSprintReport(sprint: any, tasks: any[], dataPoints: any[]) {
  const total = tasks.length;
  const done = tasks.filter((t: any) => t.phaseIsTerminal).length;
  const inprog = tasks.filter((t: any) => !t.phaseIsTerminal && t.phaseName).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const taskRows = tasks.map((t: any) => {
    const statusColor = t.phaseColor ?? "#94a3b8";
    return `<tr>
      <td>${t.title}</td>
      <td><span style="background:${statusColor}22;color:${statusColor};padding:2px 8px;border-radius:12px;font-size:11px;">${t.phaseName ?? "—"}</span></td>
      <td>${t.priority ?? "—"}</td>
      <td>${t.setor ?? "—"}</td>
      <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
    </tr>`;
  }).join("");

  const startStr = sprint.startDate ? new Date(sprint.startDate).toLocaleDateString("pt-BR") : "—";
  const endStr = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString("pt-BR") : "—";

  const html = `
    ${pdfHeader(`Sprint: ${sprint.name}`, `${startStr} → ${endStr}`)}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
        ${kpiBox("Total de Tarefas", total)}
        ${kpiBox("Concluídas", done, "#16a34a")}
        ${kpiBox("Em Andamento", inprog, "#2563eb")}
        ${kpiBox("Taxa de Conclusão", rate + "%", rate >= 70 ? "#16a34a" : "#dc2626")}
      </div>

      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:16px;">Burndown Chart</h3>
      <div style="background:#ffffff;border-radius:10px;padding:20px 16px;border:1px solid #dbe3ea;margin-bottom:28px;overflow-x:auto;">
        ${burndownSvg(dataPoints, total)}
        <div style="display:flex;gap:20px;margin-top:8px;font-size:11px;color:#475569;">
          <span>— — Linha Ideal</span>
          <span style="color:${BLUE};font-weight:600;">—— Progresso Real</span>
        </div>
      </div>

      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Tarefas da Sprint</h3>
      <table>
        <thead><tr><th>Título</th><th>Status</th><th>Prioridade</th><th>Disciplina</th><th>Prazo</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, `Sprint - ${sprint.name}`);
}

// ─── Blocked Tasks Report ─────────────────────────────────────────────────────
function exportBlockedReport(blockedTasks: any[], clientName?: string) {
  const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
  const priorityColor: Record<string, string> = { low: "#475569", medium: REPORT_PALETTE.yellow, high: "#ef4444", urgent: "#0f172a" };

  const rows = blockedTasks.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #dbe3ea;font-weight:500">${t.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #dbe3ea;color:#475569">${t.projectName ?? "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #dbe3ea;color:#475569">${t.assigneeName ?? "Não atribuído"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #dbe3ea;color:${priorityColor[t.priority] ?? BLUE};font-weight:600">${priorityLabel[t.priority] ?? t.priority}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #dbe3ea;color:#ef4444">${t.blockReason ?? "Motivo não informado"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #dbe3ea;color:#94a3b8;font-size:11px">${t.statusChangedAt ? new Date(t.statusChangedAt).toLocaleDateString("pt-BR") : "—"}</td>
    </tr>`).join("");

  const html = `
    ${pdfHeader("Relatório de Tarefas Bloqueadas", clientName ? `Cliente: ${clientName}` : "Órbita — Plataforma de Gestão de Projetos")}
    <div style="padding:28px 36px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="background:#fee2e2;color:#ef4444;border-radius:8px;padding:12px 20px;font-size:24px;font-weight:800;">${blockedTasks.length}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:${BLUE}">Tarefas Bloqueadas</div>
          <div style="font-size:12px;color:#475569">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>
      ${blockedTasks.length === 0
        ? `<div style="text-align:center;padding:40px;color:#475569;">Nenhuma tarefa bloqueada no momento.</div>`
        : `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#eef2f7;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea">Tarefa</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea">Projeto</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea">Responsável</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea">Prioridade</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea">Motivo do Bloqueio</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea">Bloqueado em</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Tarefas Bloqueadas — Órbita");
}

// ─── Member Performance Report ────────────────────────────────────────────────
function exportMemberPerformanceReport(members: any[], projectName?: string, clientName?: string) {
  const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
  const totalBlocked = members.reduce((s, m) => s + m.blocked, 0);
  const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
  const avgRate = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.completionRate, 0) / members.length)
    : 0;

  // Bar chart: taxa de conclusão por membro
  const chartW = 820, labelW = 180, barAreaW = chartW - labelW - 70, barH = 22, gap = 10;
  const chartRows = members.map((m, i) => {
    const bw = Math.max(Math.round((m.completionRate / 100) * barAreaW), 2);
    const color = m.completionRate >= 80 ? "#16a34a" : m.completionRate >= 50 ? REPORT_PALETTE.yellow : "#ef4444";
    const y = i * (barH + gap) + 4;
    const label = (m.userName ?? "?").length > 22 ? (m.userName ?? "?").slice(0, 22) + "…" : (m.userName ?? "?");
    return `
      <text x="0" y="${y + barH - 5}" font-size="11" fill="#334155" font-family="Inter,sans-serif">${label}</text>
      <rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" rx="4" fill="${color}" opacity="0.85"/>
      <text x="${labelW + bw + 6}" y="${y + barH - 5}" font-size="11" fill="${color}" font-weight="700" font-family="Inter,sans-serif">${m.completionRate}%</text>`;
  }).join("");
  const svgH = members.length * (barH + gap) + 20;
  const chartSvg = `<svg width="${chartW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${chartRows}</svg>`;

  // Stacked bar chart: distribuição de status por membro
  const stackRows = members.map((m, i) => {
    const total = m.total || 1;
    const segments = [
      { val: m.completed, color: "#16a34a" },
      { val: m.inProgress, color: "#2563eb" },
      { val: m.shared, color: REPORT_PALETTE.yellow },
      { val: m.blocked, color: "#ef4444" },
      { val: m.pending, color: "#94a3b8" },
    ];
    const y = i * (barH + gap) + 4;
    const label = (m.userName ?? "?").length > 22 ? (m.userName ?? "?").slice(0, 22) + "…" : (m.userName ?? "?");
    let x = labelW;
    const rects = segments.map(seg => {
      const w = Math.round((seg.val / total) * barAreaW);
      const rect = w > 0 ? `<rect x="${x}" y="${y}" width="${w}" height="${barH}" fill="${seg.color}" opacity="0.85"/>` : "";
      x += w;
      return rect;
    }).join("");
    return `
      <text x="0" y="${y + barH - 5}" font-size="11" fill="#334155" font-family="Inter,sans-serif">${label}</text>
      ${rects}
      <text x="${labelW + barAreaW + 6}" y="${y + barH - 5}" font-size="11" fill="#334155" font-family="Inter,sans-serif">${m.total}</text>`;
  }).join("");
  const stackSvg = `<svg width="${chartW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${stackRows}</svg>`;

  const rateBar = (rate: number) =>
    `<div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;height:6px;background:#dbe3ea;border-radius:3px;overflow:hidden;">
        <div style="width:${rate}%;height:100%;background:${getReportRateColor(rate)};border-radius:3px;"></div>
      </div>
      <span style="font-size:11px;font-weight:600;color:${rate >= 80 ? "#16a34a" : rate >= 50 ? "#854d0e" : "#991b1b"};min-width:32px;">${rate}%</span>
    </div>`;

  const memberRows = members.map((m, i) => `
    <tr style="${i % 2 === 0 ? "background:#ffffff;" : ""}">
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:${m.avatarColor ?? BLUE};color:${WHITE};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">
            ${m.avatarInitials ?? (m.userName ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <span style="font-weight:500;">${m.userName}</span>
        </div>
      </td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;">${m.total}</td>
      <td style="padding:10px 12px;text-align:center;color:#16a34a;font-weight:600;">${m.completed}</td>
      <td style="padding:10px 12px;text-align:center;color:#2563eb;">${m.inProgress}</td>
      <td style="padding:10px 12px;text-align:center;color:#ffbe00;">${m.shared}</td>
      <td style="padding:10px 12px;text-align:center;color:#ef4444;">${m.blocked}</td>
      <td style="padding:10px 12px;text-align:center;color:#dc2626;">${m.overdue}</td>
      <td style="padding:10px 12px;min-width:140px;">${rateBar(m.completionRate)}</td>
    </tr>`).join("");

  const subtitle = clientName ? `Cliente: ${clientName}` : projectName ? `Projeto: ${projectName}` : "Todos os projetos";
  const html = `
    ${pdfHeader("Desempenho por Membro", subtitle)}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
        ${kpiBox("Membros", members.length)}
        ${kpiBox("Tarefas Concluídas", totalCompleted, "#16a34a")}
        ${kpiBox("Taxa Média", avgRate + "%", avgRate >= 70 ? "#16a34a" : "#dc2626")}
        ${kpiBox("Bloqueadas / Atrasadas", totalBlocked + " / " + totalOverdue, "#dc2626")}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:8px;">Taxa de Conclusão por Membro</h3>
      <div style="background:#ffffff;border-radius:8px;padding:16px;margin-bottom:24px;overflow:hidden;">
        ${chartSvg}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:4px;">Distribuição de Status por Membro</h3>
      <div style="display:flex;gap:16px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:#334155;"><span style="display:inline-block;width:10px;height:10px;background:#16a34a;border-radius:2px;margin-right:4px;"></span>Concluídas</span>
        <span style="font-size:11px;color:#334155;"><span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:2px;margin-right:4px;"></span>Em Andamento</span>
        <span style="font-size:11px;color:#334155;"><span style="display:inline-block;width:10px;height:10px;background:#ffbe00;border-radius:2px;margin-right:4px;"></span>Compartilhado</span>
        <span style="font-size:11px;color:#334155;"><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:4px;"></span>Bloqueadas</span>
        <span style="font-size:11px;color:#334155;"><span style="display:inline-block;width:10px;height:10px;background:#94a3b8;border-radius:2px;margin-right:4px;"></span>Pendentes</span>
      </div>
      <div style="background:#ffffff;border-radius:8px;padding:16px;margin-bottom:24px;overflow:hidden;">
        ${stackSvg}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Detalhamento Individual</h3>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr style="background:#eef2f7;">
            <th style="padding:10px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Membro</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Total</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Concluídas</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Em Andamento</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Compartilhado</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Bloqueadas</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Atrasadas</th>
            <th style="padding:10px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Taxa de Conclusão</th>
          </tr>
        </thead>
        <tbody>${memberRows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Desempenho por Membro — Órbita");
}

// ──// ─── Annual Report ──────────────────────────────────────────────────────
function exportAnnualReport(data: any, clientName?: string) {
  const { year, summary, tasksByCrs, memberStats, monthlyTrend } = data;
  const subtitle = clientName ? `Cliente: ${clientName} • Ano: ${year}` : `Ano: ${year}`;

  // Monthly trend SVG
  const months = (monthlyTrend ?? []) as any[];
  const maxMonthly = Math.max(1, ...months.map((m: any) => Math.max(m.created, m.completed)));
  const mW = 820, mH = 140, padL = 30, padR = 10, padT = 10, padB = 30;
  const barAreaW = mW - padL - padR;
  const barW = months.length > 0 ? Math.floor((barAreaW / months.length) * 0.35) : 20;
  const gap2 = months.length > 0 ? Math.floor(barAreaW / months.length) : 60;
  const yScaleM = (v: number) => padT + (mH - padT - padB) - (v / maxMonthly) * (mH - padT - padB);
  const monthlySvg = `<svg width="${mW}" height="${mH}" xmlns="http://www.w3.org/2000/svg">
    ${months.map((m: any, i: number) => {
      const x = padL + i * gap2;
      const yC = yScaleM(m.created); const yD = yScaleM(m.completed);
      const hC = mH - padB - yC; const hD = mH - padB - yD;
      return `<rect x="${x}" y="${yC}" width="${barW}" height="${Math.max(hC, 1)}" rx="2" fill="#93c5fd"/>
        <rect x="${x + barW + 2}" y="${yD}" width="${barW}" height="${Math.max(hD, 1)}" rx="2" fill="#0f3b5f"/>
        <text x="${x + barW}" y="${mH - 10}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter,sans-serif">${m.monthName}</text>`;
    }).join('')}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${mH - padB}" stroke="#dbe3ea" stroke-width="1"/>
    <line x1="${padL}" y1="${mH - padB}" x2="${mW - padR}" y2="${mH - padB}" stroke="#dbe3ea" stroke-width="1"/>
    <rect x="${mW - 160}" y="${padT}" width="10" height="10" rx="2" fill="#93c5fd"/>
    <text x="${mW - 146}" y="${padT + 9}" font-size="10" fill="#334155" font-family="Inter,sans-serif">Criadas</text>
    <rect x="${mW - 90}" y="${padT}" width="10" height="10" rx="2" fill="#0f3b5f"/>
    <text x="${mW - 76}" y="${padT + 9}" font-size="10" fill="#334155" font-family="Inter,sans-serif">Concluídas</text>
  </svg>`;

  // Tasks by contract rows
  const crsRows = (tasksByCrs ?? []).slice(0, 20).map((c: any, i: number) => `
    <tr style="${i % 2 === 0 ? 'background:#ffffff;' : ''}">
      <td style="padding:8px 12px;font-weight:500;">${c.crsCode ? `<span style="color:#475569;font-size:10px;margin-right:6px;">${c.crsCode}</span>` : ''}${c.crsName}</td>
      <td style="padding:8px 12px;color:#334155;">${c.clientName}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:600;">${c.totalTasks}</td>
      <td style="padding:8px 12px;text-align:center;color:#16a34a;font-weight:600;">${c.completedTasks}</td>
      <td style="padding:8px 12px;text-align:center;color:#ef4444;">${c.overdueTasks}</td>
      <td style="padding:8px 12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:6px;background:#dbe3ea;border-radius:3px;overflow:hidden;">
            <div style="width:${c.progress}%;height:100%;background:${c.progress >= 80 ? '#16a34a' : c.progress >= 50 ? '#2563eb' : REPORT_PALETTE.yellow};border-radius:3px;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;color:#0f3b5f;min-width:30px;">${c.progress}%</span>
        </div>
      </td>
    </tr>`).join('');

  // Member stats rows
  const memberRows2 = (memberStats ?? []).slice(0, 15).map((m: any, i: number) => `
    <tr style="${i % 2 === 0 ? 'background:#ffffff;' : ''}">
      <td style="padding:8px 12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;border-radius:50%;background:${BLUE};color:${WHITE};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${(m.userName ?? '?').slice(0, 2).toUpperCase()}</div>
          <span style="font-weight:500;">${m.userName}</span>
        </div>
      </td>
      <td style="padding:8px 12px;text-align:center;font-weight:700;">${m.totalTasks}</td>
      <td style="padding:8px 12px;text-align:center;color:#16a34a;font-weight:600;">${m.completedTasks}</td>
      <td style="padding:8px 12px;text-align:center;color:#ef4444;">${m.overdueTasks}</td>
      <td style="padding:8px 12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:6px;background:#dbe3ea;border-radius:3px;overflow:hidden;">
            <div style="width:${m.completionRate}%;height:100%;background:${m.completionRate >= 80 ? '#16a34a' : m.completionRate >= 50 ? REPORT_PALETTE.yellow : '#ef4444'};border-radius:3px;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;min-width:30px;">${m.completionRate}%</span>
        </div>
      </td>
    </tr>`).join('');

  const html = `
    ${pdfHeader(`Relatório Anual ${year}`, subtitle)}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${kpiBox('Contratos', summary.totalContracts)}
        ${kpiBox('Tarefas Totais', summary.totalTasks)}
        ${kpiBox('Concluídas', summary.completedTasks, '#16a34a')}
        ${kpiBox('Taxa de Conclusão', summary.completionRate + '%', summary.completionRate >= 70 ? '#16a34a' : '#dc2626')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${kpiBox('Em Andamento', summary.inProgressTasks, '#2563eb')}
        ${kpiBox('Pendentes', summary.pendingTasks, REPORT_PALETTE.yellow)}
        ${kpiBox('Em Atraso', summary.overdueTasks, '#ef4444')}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:8px;">Tendência Mensal de Tarefas</h3>
      <div style="background:#ffffff;border-radius:8px;padding:16px;margin-bottom:28px;">${monthlySvg}</div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Tarefas por Contrato</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:28px;">
        <thead><tr style="background:#eef2f7;">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Contrato</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Cliente</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Total</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Concluídas</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Em Atraso</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Progresso</th>
        </tr></thead>
        <tbody>${crsRows}</tbody>
      </table>
      ${(memberStats ?? []).length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Desempenho por Membro</h3>
      <table style="border-collapse:collapse;width:100%;">
        <thead><tr style="background:#eef2f7;">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Membro</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Total</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Concluídas</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Em Atraso</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#334155;border-bottom:2px solid #dbe3ea;">Taxa</th>
        </tr></thead>
        <tbody>${memberRows2}</tbody>
      </table>` : ''}
    </div>
    ${pdfFooter()}`;
  openPrint(html, `Relatório Anual ${year} — Órbita`);
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function Reports() {
  const [, navigate] = useLocation();
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedReportProject, setSelectedReportProject] = useState("all");
  const [selectedSprint, setSelectedSprint] = useState("none");
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState("none");
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const projectsQ = trpc.tasks.listWithCounts.useQuery();
  const sprintsQ = trpc.sprints.listAll.useQuery();
  const statsQ = trpc.dashboard.stats.useQuery({ clientId: undefined });
  const clientsQ = trpc.clients.list.useQuery();
  const blockedTasksQ = trpc.tasks.listBlocked.useQuery();
  const memberPerfCrsId = selectedProjectForMembers !== "none" ? Number(selectedProjectForMembers) : undefined;
  const memberPerfQ = trpc.users.memberPerformance.useQuery({ crsId: memberPerfCrsId });
  const annualReportQ = trpc.dashboard.annualReport.useQuery(
    { year: Number(selectedYear), clientId: selectedClient !== "all" ? Number(selectedClient) : undefined },
    { enabled: false }
  );

  const allProjects = (projectsQ.data ?? []) as any[];
  const allSprints = (sprintsQ.data ?? []) as any[];
  const stats = statsQ.data;
  const clients = (clientsQ.data ?? []) as any[];

  // Filter projects and sprints by selected client
  const projects = useMemo(() => {
    const byClient = selectedClient === "all"
      ? allProjects
      : allProjects.filter((p: any) => String(p.clientId) === selectedClient);
    if (selectedReportProject === "all") return byClient;
    return byClient.filter((p: any) => String(p.id) === selectedReportProject);
  }, [allProjects, selectedClient, selectedReportProject]);

  const sprints = useMemo(() => {
    const projectIds = new Set(projects.map((p: any) => p.id));
    return allSprints.filter((s: any) => projectIds.has(s.crsId));
  }, [allSprints, projects]);

  const selectedClientObj = useMemo(
    () => clients.find((c: any) => String(c.id) === selectedClient),
    [clients, selectedClient]
  );

  const isLoading = projectsQ.isLoading || sprintsQ.isLoading;
  const previewTaskCount = projects.reduce((sum: number, project: any) => sum + (project.taskCounts?.total ?? 0), 0);
  const previewCompletedCount = projects.reduce((sum: number, project: any) => sum + (project.taskCounts?.published ?? 0) + (project.taskCounts?.archived ?? 0), 0);

  // Sprint detail query (only when sprint selected) - includes tasks and dataPoints
  const sprintDetailQ = trpc.sprints.get.useQuery(
    { id: Number(selectedSprint) },
    { enabled: selectedSprint !== "none" && !isNaN(Number(selectedSprint)) }
  );

  const selectedSprintObj = useMemo(
    () => sprints.find((s: any) => String(s.id) === selectedSprint),
    [sprints, selectedSprint]
  );

  const selectedProjectObj = useMemo(
    () => projects.find((p: any) => String(p.id) === selectedProjectForMembers),
    [projects, selectedProjectForMembers]
  );

  // Filtered blocked tasks by client
  const blockedTasks = useMemo(() => {
    const all = (blockedTasksQ.data ?? []) as any[];
    if (selectedClient === "all") return all;
    const clientProjectNames = new Set(projects.map((p: any) => p.name));
    return all.filter((t: any) => clientProjectNames.has(t.projectName));
  }, [blockedTasksQ.data, projects, selectedClient]);

  function handleExport(type: string) {
    setLoadingReport(type);
    const clientName = selectedClientObj?.name;
    try {
      if (type === "ai-chat") {
        navigate("/ai-chat");
      } else if (type === "dashboard") {
        exportDashboardReport(projects, stats, sprints, clientName);
      } else if (type === "projects") {
        exportProjectsReport(projects, clients, clientName);
      } else if (type === "sprint") {
        if (!selectedSprintObj) { toast.error("Selecione uma sprint primeiro."); return; }
        const sprintData = sprintDetailQ.data as any;
        const sprintTasks = (sprintData?.tasks ?? []) as any[];
        const dataPoints = (sprintData?.dataPoints ?? []) as any[];
        exportSprintReport(selectedSprintObj, sprintTasks, dataPoints);
      } else if (type === "blocked") {
        exportBlockedReport(blockedTasks, clientName);
      } else if (type === "members") {
        const memberData = (memberPerfQ.data ?? []) as any[];
        exportMemberPerformanceReport(memberData, selectedProjectObj?.name, clientName);
      } else if (type === "annual") {
        setLoadingReport("annual");
        annualReportQ.refetch().then(({ data }) => {
          if (data) {
            exportAnnualReport(data, clientName);
          } else {
            toast.error("Erro ao carregar dados do relatório anual.");
          }
        }).catch(() => toast.error("Erro ao gerar relatório anual."))
          .finally(() => setLoadingReport(null));
        return;
      }
    } catch (e) {
      toast.error("Erro ao gerar relatório.");
    } finally {
      setLoadingReport(null);
    }
  }

  const reportCards = [
    {
      id: "ai-chat",
      icon: MessageSquare,
      title: "Relatório do Chat IA",
      description: "Abra o assistente para revisar a conversa atual e exportar a última resposta da IA em PDF com a identidade LS Solutions.",
      badge: "IA",
      badgeColor: "bg-teal-50 text-teal-700",
      actionLabel: "Abrir Chat IA",
      extra: null,
    },
    {
      id: "dashboard",
      icon: BarChart2,
      title: "Relatório do Dashboard",
      description: "Visão geral de todos os projetos: KPIs, taxa de conclusão, tarefas por status e lista completa de projetos.",
      badge: "Visão Geral",
      badgeColor: "bg-blue-100 text-blue-700",
      extra: null,
    },
    {
      id: "projects",
      icon: FolderKanban,
      title: "Relatório de Projetos",
      description: "Lista detalhada de todos os projetos com cliente vinculado, status, total de tarefas, taxa de conclusão e gráfico de barras de progresso.",
      badge: "Projetos",
      badgeColor: "bg-blue-100 text-blue-700",
      extra: null,
    },
    {
      id: "blocked",
      icon: ShieldAlert,
      title: "Tarefas Bloqueadas",
      description: "Lista todas as tarefas com status Bloqueado: motivo do bloqueio, responsável, projeto, prioridade e data de bloqueio.",
      badge: "Impedimentos",
      badgeColor: "bg-red-50 text-red-600",
      extra: (
        <div className="mt-2">
          {blockedTasksQ.isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando...</div>
          ) : blockedTasks.length > 0 ? (
            <div className="text-sm text-red-600 font-semibold">{blockedTasks.length} tarefa{blockedTasks.length !== 1 ? "s" : ""} bloqueada{blockedTasks.length !== 1 ? "s" : ""} encontrada{blockedTasks.length !== 1 ? "s" : ""}</div>
          ) : (
            <div className="text-xs text-blue-600">Nenhuma tarefa bloqueada no momento</div>
          )}
        </div>
      ),
    },
    {
      id: "members",
      icon: Users,
      title: "Desempenho por Membro",
      description: "Relatório individual de cada membro da equipe: total de tarefas, concluídas, em andamento, bloqueadas e taxa de conclusão.",
      badge: "Equipe",
      badgeColor: "bg-blue-50 text-blue-600",
      extra: (
        <div className="mt-3 space-y-2">
          <Select value={selectedProjectForMembers} onValueChange={setSelectedProjectForMembers}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Filtrar por projeto (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Todos os projetos</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {memberPerfQ.data && memberPerfQ.data.length > 0 && (
            <p className="text-xs text-muted-foreground">{memberPerfQ.data.length} membro{memberPerfQ.data.length !== 1 ? "s" : ""} encontrado{memberPerfQ.data.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      ),
    },
    {
      id: "annual",
      icon: CalendarDays,
      title: "Relatório Anual",
      description: "Relatório consolidado do ano: KPIs gerais, tendência mensal de tarefas, desempenho por contrato e por membro da equipe.",
      badge: "Anual",
      badgeColor: "bg-indigo-50 text-indigo-700",
      extra: (
        <div className="mt-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecionar ano..." />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      id: "sprint",
      icon: Zap,
      title: "Relatório de Sprint",
      description: "Relatório completo de uma sprint específica: KPIs, burndown chart (linha ideal vs real) e lista de tarefas com status e responsável.",
      badge: "Sprint",
      badgeColor: "bg-blue-100 text-blue-700",
      extra: (
        <div className="mt-3">
          <Select value={selectedSprint} onValueChange={setSelectedSprint}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecionar sprint..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecionar sprint...</SelectItem>
              {sprints.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}{s.crsName ? ` — ${s.crsName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Relatórios" fullHeight>
      <SplitLayout
        leftWidth="220px"
        left={
          <>
            <SplitPanelHeader title="Relatórios" subtitle="Exportar PDF" />
            <SplitPanelContent>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Filtrar por cliente</p>
                <Select value={selectedClient} onValueChange={(v) => {
                  setSelectedClient(v);
                  setSelectedReportProject("all");
                  setSelectedSprint("none");
                  setSelectedProjectForMembers("none");
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs font-medium text-muted-foreground mt-4">Filtrar por projeto</p>
                <Select value={selectedReportProject} onValueChange={(v) => { setSelectedReportProject(v); setSelectedSprint("none"); setSelectedProjectForMembers("none"); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos os projetos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {allProjects.filter((p: any) => selectedClient === "all" || String(p.clientId) === selectedClient).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs font-medium text-muted-foreground mt-4">Período de referência</p>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
                {selectedClient !== "all" && selectedClientObj && (
                  <div className="space-y-1">
                    <Badge variant="secondary" className="gap-1 text-xs w-full justify-start">
                      <Filter className="w-3 h-3" />
                      {selectedClientObj.name}
                    </Badge>
                    <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setSelectedClient("all"); setSelectedReportProject("all"); setSelectedSprint("none"); setSelectedProjectForMembers("none"); }}>Limpar filtro</button>
                  </div>
                )}
              </div>
            </SplitPanelContent>
          </>
        }
        right={
          <SplitPanelContent noPadding>
            <div className="p-4 space-y-5 overflow-y-auto h-full">

        {/* Filtered data preview */}
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Filter className="w-4 h-4 text-primary" />Prévia dos dados filtrados</CardTitle><CardDescription>Confira o escopo atual antes de gerar qualquer PDF.</CardDescription></CardHeader>
          <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-background border border-border p-3"><p className="text-xs text-muted-foreground">Projetos</p><p className="text-xl font-bold text-foreground">{projects.length}</p></div>
            <div className="rounded-lg bg-background border border-border p-3"><p className="text-xs text-muted-foreground">Tarefas</p><p className="text-xl font-bold text-foreground">{previewTaskCount}</p></div>
            <div className="rounded-lg bg-background border border-border p-3"><p className="text-xs text-muted-foreground">Concluídas</p><p className="text-xl font-bold text-green-600">{previewCompletedCount}</p></div>
            <div className="rounded-lg bg-background border border-border p-3"><p className="text-xs text-muted-foreground">Sprints</p><p className="text-xl font-bold text-foreground">{sprints.length}</p></div>
          </div></CardContent>
        </Card>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {reportCards.map(({ id, icon: Icon, title, description, badge, badgeColor, extra, actionLabel }) => (
            <Card key={id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{title}</CardTitle>
                    </div>
                  </div>
                  <Badge className={`text-xs ${badgeColor} border-0 flex-shrink-0`}>{badge}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <CardDescription className="text-sm leading-relaxed">
                  {description}
                </CardDescription>
                {extra}
                <div className="mt-auto">
                  <Button
                    className="w-full gap-2"
                    disabled={
                      isLoading ||
                      loadingReport === id ||
                      (id === "sprint" && selectedSprint === "none") ||
                      (id === "sprint" && sprintDetailQ.isLoading && selectedSprint !== "none") ||
                      (id === "members" && memberPerfQ.isLoading)
                    }
                    onClick={() => handleExport(id)}
                  >
                    {loadingReport === id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    {actionLabel ?? "Exportar PDF"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info box */}
        <div className="rounded-xl border border-border bg-muted/40 p-5">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Como funciona:</strong> Ao clicar em "Exportar PDF", uma nova aba será aberta com o relatório formatado. 
            Use o botão "Imprimir / Salvar PDF" na nova aba ou o atalho <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">Ctrl+P</kbd> para salvar como PDF.
            O filtro por cliente no topo aplica-se a todos os relatórios gerados.
          </p>
        </div>
            </div>
          </SplitPanelContent>
        }
      />
    </AppLayout>
  );
}
