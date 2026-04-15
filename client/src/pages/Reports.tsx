import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileDown, BarChart2, Zap, FolderKanban, Loader2, ShieldAlert, Users, Filter } from "lucide-react";
import { toast } from "sonner";

// ─── PDF helpers ───────────────────────────────────────────────────────────────

const BLUE = "#1e3a5f";
const WHITE = "#ffffff";

function pdfHeader(title: string, subtitle?: string) {
  return `
    <div style="background:${BLUE};color:${WHITE};padding:28px 36px 20px;border-radius:10px 10px 0 0;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${WHITE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
          </svg>
        </div>
        <div>
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:2px;">Orbita — Gerenciamento de Projetos</div>
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
    <div style="margin-top:40px;padding:14px 36px;background:${BLUE};border-radius:0 0 10px 10px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:13px;font-weight:700;color:${WHITE};">Orbita</span>
      <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.55);">Relatório gerado automaticamente</span>
    </div>`;
}

function kpiBox(label: string, value: string | number, color = BLUE) {
  return `<div style="background:#f8fafc;border-radius:8px;padding:16px 20px;text-align:center;border:1px solid #e2e8f0;">
    <div style="font-size:28px;font-weight:800;color:${color};">${value}</div>
    <div style="font-size:11px;color:#64748b;margin-top:4px;">${label}</div>
  </div>`;
}

function openPrint(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up bloqueado. Permita pop-ups para exportar."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,sans-serif;margin:0;padding:24px;background:#f0f2f5;}
      table{border-collapse:collapse;width:100%;}
      th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px;}
      th{background:#f1f5f9;font-weight:600;color:#475569;}
      @media print{body{padding:0;background:#fff;}button{display:none!important;}}
    </style></head><body>
    <div style="max-width:960px;margin:0 auto;">
      ${html}
      <div style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="background:${BLUE};color:${WHITE};border:none;padding:10px 28px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">Imprimir / Salvar PDF</button>
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
      <text x="0" y="${y + barH - 5}" font-size="11" fill="#475569" font-family="Inter,sans-serif">${item.label.length > 22 ? item.label.slice(0, 22) + "…" : item.label}</text>
      <rect x="${labelW}" y="${y}" width="${Math.max(barW, 2)}" height="${barH}" rx="4" fill="${item.color}" opacity="0.85"/>
      <text x="${labelW + barW + 6}" y="${y + barH - 5}" font-size="11" fill="#1e3a5f" font-weight="700" font-family="Inter,sans-serif">${item.value}%</text>`;
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
      `<line x1="${padL}" y1="${yScale(v).toFixed(1)}" x2="${padL + w}" y2="${yScale(v).toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`
    ).join("")}
    <!-- Ideal line (dashed) -->
    <path d="${idealPath}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6,4" fill="none"/>
    <!-- Remaining line -->
    <path d="${remainPath}" stroke="#1e3a5f" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <!-- Axes -->
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + h}" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="${padL}" y1="${padT + h}" x2="${padL + w}" y2="${padT + h}" stroke="#cbd5e1" stroke-width="1"/>
    ${xLabels}
    ${yLabels}
    <!-- Legend -->
    <rect x="${padL + w - 180}" y="${padT}" width="12" height="3" rx="1" fill="#94a3b8"/>
    <text x="${padL + w - 164}" y="${padT + 7}" font-size="10" fill="#94a3b8" font-family="Inter,sans-serif">Ideal</text>
    <rect x="${padL + w - 110}" y="${padT}" width="12" height="3" rx="1" fill="#1e3a5f"/>
    <text x="${padL + w - 94}" y="${padT + 7}" font-size="10" fill="#1e3a5f" font-family="Inter,sans-serif">Real</text>
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
        ${kpiBox("Sprints Ativas", sprints.filter((s: any) => s.status === "active").length, "#7c3aed")}
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
      color: rate >= 80 ? "#16a34a" : rate >= 50 ? "#f59e0b" : "#ef4444",
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
      <div style="background:#f8fafc;border-radius:10px;padding:20px 16px;border:1px solid #e2e8f0;margin-bottom:28px;overflow-x:auto;">
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
      <div style="background:#f8fafc;border-radius:10px;padding:20px 16px;border:1px solid #e2e8f0;margin-bottom:28px;overflow-x:auto;">
        ${burndownSvg(dataPoints, total)}
        <div style="display:flex;gap:20px;margin-top:8px;font-size:11px;color:#64748b;">
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
  const priorityColor: Record<string, string> = { low: "#64748b", medium: "#f59e0b", high: "#ef4444", urgent: "#7c3aed" };

  const rows = blockedTasks.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500">${t.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.projectName ?? "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.assigneeName ?? "Não atribuído"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${priorityColor[t.priority] ?? BLUE};font-weight:600">${priorityLabel[t.priority] ?? t.priority}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#ef4444">${t.blockReason ?? "Motivo não informado"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#94a3b8;font-size:11px">${t.statusChangedAt ? new Date(t.statusChangedAt).toLocaleDateString("pt-BR") : "—"}</td>
    </tr>`).join("");

  const html = `
    ${pdfHeader("Relatório de Tarefas Bloqueadas", clientName ? `Cliente: ${clientName}` : "Orbita — Plataforma de Gestão de Projetos")}
    <div style="padding:28px 36px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="background:#fee2e2;color:#ef4444;border-radius:8px;padding:12px 20px;font-size:24px;font-weight:800;">${blockedTasks.length}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:${BLUE}">Tarefas Bloqueadas</div>
          <div style="font-size:12px;color:#64748b">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>
      ${blockedTasks.length === 0
        ? `<div style="text-align:center;padding:40px;color:#64748b;">Nenhuma tarefa bloqueada no momento.</div>`
        : `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Tarefa</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Projeto</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Responsável</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Prioridade</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Motivo do Bloqueio</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Bloqueado em</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Tarefas Bloqueadas — Orbita");
}

// ─── Member Performance Report ────────────────────────────────────────────────
function exportMemberPerformanceReport(members: any[], projectName?: string, clientName?: string) {
  const totalTasks = members.reduce((s, m) => s + m.total, 0);
  const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
  const avgRate = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.completionRate, 0) / members.length)
    : 0;

  const rateBar = (rate: number) =>
    `<div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
        <div style="width:${rate}%;height:100%;background:${rate >= 80 ? "#16a34a" : rate >= 50 ? "#f59e0b" : "#ef4444"};border-radius:3px;"></div>
      </div>
      <span style="font-size:11px;font-weight:600;color:${rate >= 80 ? "#16a34a" : rate >= 50 ? "#854d0e" : "#991b1b"};min-width:32px;">${rate}%</span>
    </div>`;

  const memberRows = members.map((m, i) => `
    <tr style="${i % 2 === 0 ? "background:#f8fafc;" : ""}">
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:${BLUE};color:${WHITE};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">
            ${(m.userName ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <span style="font-weight:500;">${m.userName}</span>
        </div>
      </td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;">${m.total}</td>
      <td style="padding:10px 12px;text-align:center;color:#16a34a;font-weight:600;">${m.completed}</td>
      <td style="padding:10px 12px;text-align:center;color:#2563eb;">${m.inProgress}</td>
      <td style="padding:10px 12px;text-align:center;color:#f59e0b;">${m.shared}</td>
      <td style="padding:10px 12px;text-align:center;color:#ef4444;">${m.blocked}</td>
      <td style="padding:10px 12px;min-width:140px;">${rateBar(m.completionRate)}</td>
    </tr>`).join("");

  const subtitle = clientName ? `Cliente: ${clientName}` : projectName ? `Projeto: ${projectName}` : "Todos os projetos";

  const html = `
    ${pdfHeader("Desempenho por Membro", subtitle)}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${kpiBox("Membros", members.length)}
        ${kpiBox("Tarefas Concluídas", totalCompleted, "#16a34a")}
        ${kpiBox("Taxa Média", avgRate + "%", avgRate >= 70 ? "#16a34a" : "#dc2626")}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLUE};margin-bottom:12px;">Desempenho Individual</h3>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Membro</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Total</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Concluídas</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Em Andamento</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Compartilhado</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Bloqueadas</th>
            <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;">Taxa de Conclusão</th>
          </tr>
        </thead>
        <tbody>${memberRows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Desempenho por Membro — Orbita");
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reports() {
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedSprint, setSelectedSprint] = useState("none");
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState("none");
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const projectsQ = trpc.tasks.listWithCounts.useQuery();
  const sprintsQ = trpc.sprints.listAll.useQuery();
  const statsQ = trpc.dashboard.stats.useQuery({ clientId: undefined });
  const clientsQ = trpc.clients.list.useQuery();
  const blockedTasksQ = trpc.tasks.listBlocked.useQuery();
  const memberPerfCrsId = selectedProjectForMembers !== "none" ? Number(selectedProjectForMembers) : undefined;
  const memberPerfQ = trpc.users.memberPerformance.useQuery({ crsId: memberPerfCrsId });

  const allProjects = (projectsQ.data ?? []) as any[];
  const allSprints = (sprintsQ.data ?? []) as any[];
  const stats = statsQ.data;
  const clients = (clientsQ.data ?? []) as any[];

  // Filter projects and sprints by selected client
  const projects = useMemo(() => {
    if (selectedClient === "all") return allProjects;
    return allProjects.filter((p: any) => String(p.clientId) === selectedClient);
  }, [allProjects, selectedClient]);

  const sprints = useMemo(() => {
    if (selectedClient === "all") return allSprints;
    // Filter sprints by projects belonging to selected client
    const clientProjectIds = new Set(projects.map((p: any) => p.id));
    return allSprints.filter((s: any) => clientProjectIds.has(s.crsId));
  }, [allSprints, projects, selectedClient]);

  const selectedClientObj = useMemo(
    () => clients.find((c: any) => String(c.id) === selectedClient),
    [clients, selectedClient]
  );

  const isLoading = projectsQ.isLoading || sprintsQ.isLoading;

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
      if (type === "dashboard") {
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
      }
    } catch (e) {
      toast.error("Erro ao gerar relatório.");
    } finally {
      setLoadingReport(null);
    }
  }

  const reportCards = [
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
      badgeColor: "bg-indigo-100 text-indigo-700",
      extra: null,
    },
    {
      id: "blocked",
      icon: ShieldAlert,
      title: "Tarefas Bloqueadas",
      description: "Lista todas as tarefas com status Bloqueado: motivo do bloqueio, responsável, projeto, prioridade e data de bloqueio.",
      badge: "Impedimentos",
      badgeColor: "bg-red-100 text-red-700",
      extra: (
        <div className="mt-2">
          {blockedTasksQ.isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando...</div>
          ) : blockedTasks.length > 0 ? (
            <div className="text-sm text-red-600 font-semibold">{blockedTasks.length} tarefa{blockedTasks.length !== 1 ? "s" : ""} bloqueada{blockedTasks.length !== 1 ? "s" : ""} encontrada{blockedTasks.length !== 1 ? "s" : ""}</div>
          ) : (
            <div className="text-xs text-green-600">Nenhuma tarefa bloqueada no momento</div>
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
      badgeColor: "bg-emerald-100 text-emerald-700",
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
      id: "sprint",
      icon: Zap,
      title: "Relatório de Sprint",
      description: "Relatório completo de uma sprint específica: KPIs, burndown chart (linha ideal vs real) e lista de tarefas com status e responsável.",
      badge: "Sprint",
      badgeColor: "bg-violet-100 text-violet-700",
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
    <AppLayout title="Relatórios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Relatórios</h2>
            <p className="text-muted-foreground mt-1">
              Gere e exporte relatórios em PDF para análise e compartilhamento.
            </p>
          </div>
          {/* Client filter */}
          <div className="flex items-center gap-2 min-w-[220px]">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Select value={selectedClient} onValueChange={(v) => {
              setSelectedClient(v);
              setSelectedSprint("none");
              setSelectedProjectForMembers("none");
            }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filter badge */}
        {selectedClient !== "all" && selectedClientObj && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
              <Filter className="w-3 h-3" />
              Filtrando por: <strong>{selectedClientObj.name}</strong>
              <span className="text-muted-foreground ml-1">({projects.length} projeto{projects.length !== 1 ? "s" : ""})</span>
            </Badge>
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => { setSelectedClient("all"); setSelectedSprint("none"); setSelectedProjectForMembers("none"); }}
            >
              Limpar filtro
            </button>
          </div>
        )}

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {reportCards.map(({ id, icon: Icon, title, description, badge, badgeColor, extra }) => (
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
                    Exportar PDF
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
    </AppLayout>
  );
}
