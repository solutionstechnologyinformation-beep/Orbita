import { useMemo, useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import OnboardingWizard from "@/components/OnboardingWizard";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp,
  Layers, Briefcase, FolderKanban, CalendarDays, Calendar, Zap, FileDown, Ruler, Building2, MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { MapView } from "@/components/Map";
import { getCountryByCode, COUNTRIES, getStatesForCountry } from "@/lib/geoData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const TIPO_OBRA_MAP: Record<string, string> = {
  implementacao: "Implementação",
  restauracao: "Restauração",
  aumento_capacidade: "Aumento de Capacidade",
  levantamento: "Levantamento",
  outro: "Outro",
};
const TIPO_OBRA_COLOR: Record<string, string> = {
  implementacao: "#785500",
  restauracao: "#f97316",
  aumento_capacidade: "#8b5cf6",
  levantamento: "#6b7280",
  outro: "#0ea5e9",
};
function parseTipoObra(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; } catch { return [raw]; }
}
function getPinColor(crsList: any[]): string {
  const allTypes: string[] = [];
  for (const c of crsList) {
    const types = parseTipoObra(c.tipoObra);
    allTypes.push(...types);
  }
  const unique = Array.from(new Set(allTypes.filter(Boolean)));
  if (unique.length === 1) return TIPO_OBRA_COLOR[unique[0]] ?? "#785500";
  return "#785500";
}
function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:     "#94a3b8",
  in_progress: "#3b82f6",
  shared:      "#f59e0b",
  published:   "#22c55e",
  archived:    "#6b7280",
  blocked:     "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending:     "Para Iniciar",
  in_progress: "Em Andamento",
  shared:      "Em Revisão",
  published:   "Aprovado",
  archived:    "Arquivado",
  blocked:     "Bloqueado",
};

// ── Gauge card ─────────────────────────────────────────────────────────────────
// Velocímetro segmentado estilo gauge chart
function GaugeCard({
  label, value, description, inverted = false,
}: {
  label: string; value: number; color?: string; icon?: any; description?: string; inverted?: boolean;
}) {
  // Segmentos: 10 fatias de 180° (18° cada), cores do vermelho ao verde
  const SEGMENTS = [
    '#d32f2f', '#e53935', '#e64a19', '#f57c00',
    '#f9a825', '#c0ca33', '#8bc34a', '#4caf50',
    '#2e7d32', '#1b5e20',
  ];
  const cx = 80, cy = 80, R = 62, r = 32;
  const startAngle = 180; // graus, começa na esquerda
  const totalArc = 180;   // semicírculo
  const n = SEGMENTS.length;
  const gap = 2; // gap em graus entre segmentos
  const segArc = (totalArc - gap * n) / n;

  // Calcular o valor efetivo para o ponteiro
  // inverted: 0% = bom (verde), 100% = ruim (vermelho)
  const effectiveValue = inverted ? 100 - value : value;
  const clampedVal = Math.min(100, Math.max(0, effectiveValue));

  // Converter grau para coordenada SVG (0° = direita, 180° = esquerda)
  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  // Gerar path de cada segmento
  function segPath(i: number) {
    const a1 = startAngle + i * (segArc + gap);
    const a2 = a1 + segArc;
    const p1 = polarToXY(a1, R);
    const p2 = polarToXY(a2, R);
    const p3 = polarToXY(a2, r);
    const p4 = polarToXY(a1, r);
    return `M ${p1.x} ${p1.y} A ${R} ${R} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r} ${r} 0 0 0 ${p4.x} ${p4.y} Z`;
  }

  // Ângulo do ponteiro: 180° (esquerda) → 360°/0° (direita)
  const needleAngle = startAngle + (clampedVal / 100) * totalArc;
  const needleTip = polarToXY(needleAngle, R - 6);
  const needleBase1 = polarToXY(needleAngle + 90, 6);
  const needleBase2 = polarToXY(needleAngle - 90, 6);

  // Cor do valor: verde se bom, vermelho se ruim
  const valueColor = inverted
    ? (value <= 20 ? '#2e7d32' : value <= 50 ? '#f9a825' : '#d32f2f')
    : (value >= 80 ? '#2e7d32' : value >= 50 ? '#f9a825' : '#d32f2f');

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-1">
      <p className="text-xs font-semibold text-muted-foreground text-center leading-tight">{label}</p>
      <div className="relative" style={{ width: 160, height: 92 }}>
        <svg viewBox="0 0 160 90" width="160" height="90">
          {/* Segmentos */}
          {SEGMENTS.map((color, i) => (
            <path key={i} d={segPath(i)} fill={color} opacity={0.92} />
          ))}
          {/* Ponteiro */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
            fill="#1e3a5f"
            style={{ transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          {/* Círculo central */}
          <circle cx={cx} cy={cy} r={r - 4} fill="#1e3a5f" stroke="#0f2744" strokeWidth="1.5" />
          {/* Valor */}
          <text x={cx} y={cy + 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff">{value}%</text>
        </svg>
      </div>
      {description && <p className="text-xs text-muted-foreground text-center -mt-1">{description}</p>}
    </div>
  );
}

// ── Custom donut label ─────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Dashboard PDF Export ──────────────────────────────────────────────────────────────────────────────
async function exportDashboardPDF(data: {
  stats: any; projects: any[]; sprints: any[]; recentTasks: any[];
  conflicts: any[]; clientCount: number;
  overdueP: number; completedP: number; revisionP: number; onTimeP: number;
  mapContainerEl?: HTMLElement | null;
  staticMapData?: { url: string | null; contracts: any[]; stateCount?: Record<string, number> } | null;
  contractsDetail?: any[] | null;
  clientName?: string;
  clientColor?: string;
}) {
  const { stats, projects, recentTasks, conflicts, clientCount, overdueP, completedP, revisionP, onTimeP, mapContainerEl, staticMapData, contractsDetail, clientName, clientColor } = data;
  const total = stats?.totalTasks ?? 0;
  const now = new Date().toLocaleString("pt-BR");
  const date = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const clientBadge = clientName
    ? `<span style="background:${clientColor ?? "#785500"}22;color:${clientColor ?? "#785500"};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid ${clientColor ?? "#785500"}44">${clientName}</span>`
    : "";

  const projectRows = projects.slice(0, 10).map((p: any) => {
    const ppct = Math.round(p.progress ?? 0);
    const clientLabel = p.clientName ? `<span style="font-size:10px;color:#64748b">${p.clientName}</span>` : "";
    return `<tr>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${p.name}${clientLabel ? " &mdash; " + clientLabel : ""}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${p.code ?? "&mdash;"}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">
          <div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden">
          <div style="background:#785500;height:8px;border-radius:99px;width:${ppct}%"></div>
        </div>
        <span style="font-size:10px;color:#64748b">${ppct}%</span>
      </td>
    </tr>`;
  }).join("");

  const taskRows = recentTasks.slice(0, 10).map(t => {
    const color = STATUS_COLORS[t.status] ?? "#94a3b8";
    const label = STATUS_LABELS[t.status] ?? t.status;
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "published" && t.status !== "archived";
    return `<tr>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${t.title}${isOverdue ? ' <span style="color:#ef4444;font-size:10px">⚠ Atrasada</span>' : ""}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${t.projectName ?? "—"}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">
        <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600">${label}</span>
      </td>
    </tr>`;
  }).join("");

  const conflictRows = conflicts.slice(0, 5).map(c => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${c.projectName ?? "—"}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${c.task1?.assigneeName ?? "Membro"}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${c.task1?.title ?? ""} / ${c.task2?.title ?? ""}</td>
  </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório Dashboard — Orbita</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; background: #785500; color: #ffffff; padding: 18px 28px; border-bottom: 3px solid rgba(0,0,0,0.1); }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
    .logo span { color: #ffffff; }
    .subtitle { font-size: 11px; color: rgba(0,0,0,0.55); margin-top: 2px; }
    .content { padding: 28px; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #ffffff; }
    .kpi-label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .gauge-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .gauge { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .gauge-value { font-size: 22px; font-weight: 800; }
    .gauge-label { font-size: 10px; color: #64748b; margin-top: 2px; }
    section { margin-bottom: 24px; }
    h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #334155; border-left: 3px solid #1dbab4; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #475569; padding: 7px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
    .footer { margin-top: 32px; background: #785500; padding: 12px 28px; font-size: 10px; border-radius: 0 0 8px 8px; display: flex; justify-content: space-between; align-items: center; }
    .ls-badge { display: flex; align-items: center; gap: 8px; }
    .ls-icon { width: 32px; height: 32px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
    .ls-icon span { color: #ffffff; font-weight: 900; font-size: 13px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <div>
        <div class="logo">Orbita</div>
        <div class="subtitle">Sistema de Gerenciamento de Projetos</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;font-weight:700;color:#ffffff">Relatório do Dashboard${clientName ? ` — ${clientName}` : ""}</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.55)">Gerado em ${now}</div>
    </div>
  </div>
  <div class="content">
    <h2>Acompanhamento dos Projetos</h2>
    <div class="meta" style="display:flex;align-items:center;gap:8px">${date} ${clientBadge}</div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${projects.length}</div><div class="kpi-label">Total de Projetos</div></div>
      <div class="kpi"><div class="kpi-value">${total}</div><div class="kpi-label">Total de Tarefas</div></div>
      <div class="kpi"><div class="kpi-value">${clientCount}</div><div class="kpi-label">Clientes</div></div>
      <div class="kpi"><div class="kpi-value">${stats?.overdueTasks ?? 0}</div><div class="kpi-label">Tarefas em Atraso</div></div>
    </div>

    <div class="gauge-grid">
      <div class="gauge"><div class="gauge-value" style="color:#ef4444">${overdueP}%</div><div class="gauge-label">Em Atraso</div></div>
      <div class="gauge"><div class="gauge-value" style="color:#22c55e">${completedP}%</div><div class="gauge-label">Concluídas</div></div>
      <div class="gauge"><div class="gauge-value" style="color:#f59e0b">${revisionP}%</div><div class="gauge-label">Em Revisão</div></div>
      <div class="gauge"><div class="gauge-value" style="color:#3b82f6">${onTimeP}%</div><div class="gauge-label">Dentro do Prazo</div></div>
    </div>

    ${projects.length > 0 ? `<section>
      <h3>Projetos Ativos (${projects.length})</h3>
      <table>
        <thead><tr><th>Projeto</th><th style="text-align:center">Total</th><th style="text-align:center">Concluídas</th><th>Progresso</th></tr></thead>
        <tbody>${projectRows}</tbody>
      </table>
    </section>` : ""}

    ${recentTasks.length > 0 ? `<section>
      <h3>Minhas Tarefas Recentes</h3>
      <table>
        <thead><tr><th>Tírulo</th><th>Projeto</th><th>Status</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
    </section>` : ""}

    ${conflicts.length > 0 ? `<section>
      <h3>Alertas de Conflito (${conflicts.length})</h3>
      <table>
        <thead><tr><th>Projeto</th><th>Membro</th><th>Tarefas em Conflito</th></tr></thead>
        <tbody>${conflictRows}</tbody>
      </table>
    </section>` : ""}
  </div>

  <div class="footer">
    <span style="font-size:13px;font-weight:700;color:#ffffff;">Orbita</span>
    <span style="color:rgba(0,0,0,0.55);">Gerado em ${now}</span>
  </div>
</body>
</html>`;

  // Build state summary table from staticMapData or projects
  const contractsForMap = staticMapData?.contracts ?? projects;
  const stateGroups: Record<string, { state: string; stateCode: string; countryCode: string; count: number }> = {};
  contractsForMap.forEach((p: any) => {
    if (!p.countryCode && !p.state) return;
    const key = p.stateCode ? `${p.countryCode ?? ""}-${p.stateCode}` : (p.countryCode ?? p.state ?? "?");
    if (!stateGroups[key]) stateGroups[key] = { state: p.state ?? p.stateCode ?? p.countryCode, stateCode: p.stateCode ?? "", countryCode: p.countryCode ?? "", count: 0 };
    stateGroups[key].count++;
  });
  const stateRows = Object.values(stateGroups)
    .sort((a, b) => b.count - a.count)
    .map(s => `<tr><td>${s.state || s.stateCode || s.countryCode}</td><td style="text-align:center;font-weight:700">${s.count}</td></tr>`)
    .join("");
  const stateTableHtml = stateRows ? `
    <section style="margin-top:16px">
      <h3>Contratos por Estado/Região</h3>
      <table><thead><tr><th>Estado / Região</th><th style="text-align:center">Nº de Contratos</th></tr></thead>
      <tbody>${stateRows}</tbody></table>
    </section>` : "";

  // Build detailed contract sections with tasks + checklist cascade by discipline
  const TIPO_LABELS: Record<string, string> = {
    implementacao: "Implementação", restauracao: "Restauração", levantamento: "Levantamento",
    aumento_capacidade: "Aumento de Capacidade", pavimentacao: "Pavimentação",
    sinalizacao: "Sinalização", drenagem: "Drenagem",
  };
  const STATUS_BADGE: Record<string, string> = {
    to_start: "Para Iniciar", in_progress: "Em Andamento", shared: "Compartilhado",
    published: "Publicado", archived: "Arquivado",
  };
  const detailContracts = contractsDetail ?? contractsForMap;
  const contractDetailTable = detailContracts.length > 0 ? detailContracts.map((c: any, i: number) => {
    const label = String.fromCharCode(65 + (i % 26));
    const tipos = Array.isArray(c.tiposObra)
      ? c.tiposObra.map((t: string) => TIPO_LABELS[t] ?? t).join(", ")
      : (() => { try { return (JSON.parse(c.tipoObra ?? "[]") as string[]).map((t: string) => TIPO_LABELS[t] ?? t).join(", "); } catch { return c.tipoObra ?? "—"; } })();
    const ext = c.extensaoKm ? `${c.extensaoKm} km` : (c.areaHa ? `${c.areaHa} m²` : "—");
    // Tarefas por disciplina em cascata
    const tasksByDisc = c.tasksByDiscipline ?? {};
    const checklistByTask = c.checklistByTask ?? {};
    const disciplineBlocks = Object.entries(tasksByDisc).map(([disc, tasks]: [string, any]) => {
      if (!tasks || tasks.length === 0) return "";
      const taskRows = tasks.map((t: any) => {
        const badge = STATUS_BADGE[t.status] ?? t.status ?? "—";
        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "published" && t.status !== "archived";
        const clItems = (checklistByTask[t.id] ?? []) as any[];
        const clHtml = clItems.length > 0 ? `<div style="margin-left:20px;margin-top:4px">${clItems.map((cl: any) =>
          `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:10px;color:#64748b">
            <span style="color:${cl.status === 'published' || cl.status === 'archived' ? '#22c55e' : '#94a3b8'};font-size:12px">${cl.status === 'published' || cl.status === 'archived' ? '✓' : '○'}</span>
            <span style="${cl.status === 'published' || cl.status === 'archived' ? 'text-decoration:line-through;color:#94a3b8' : ''}">${cl.title}</span>
          </div>`
        ).join("")}</div>` : "";
        return `<div style="padding:4px 8px;border-left:2px solid #e2e8f0;margin:3px 0;margin-left:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;font-weight:600">${t.title}</span>
            <span style="background:${t.status === 'published' || t.status === 'archived' ? '#22c55e22' : t.status === 'in_progress' ? '#3b82f622' : '#f59e0b22'};color:${t.status === 'published' || t.status === 'archived' ? '#16a34a' : t.status === 'in_progress' ? '#2563eb' : '#d97706'};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600">${badge}</span>
            ${isOverdue ? '<span style="color:#ef4444;font-size:9px">⚠ Atrasada</span>' : ''}
            ${t.assigneeName ? `<span style="font-size:9px;color:#64748b">→ ${t.assigneeName}</span>` : ''}
          </div>
          ${clHtml}
        </div>`;
      }).join("");
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:#785500;background:#fef9ec;padding:3px 8px;border-radius:4px;margin-bottom:4px">${disc} (${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''})</div>
        ${taskRows}
      </div>`;
    }).filter(Boolean).join("");
    return `<section style="margin-bottom:20px;page-break-inside:avoid">
      <h3 style="display:flex;align-items:center;gap:8px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#785500;color:#fff;border-radius:50%;font-size:11px;font-weight:700;flex-shrink:0">${label}</span>
        ${c.name} <span style="font-size:11px;font-weight:400;color:#64748b">${c.code ?? ""}</span>
      </h3>
      <div style="display:flex;gap:16px;margin:8px 0;flex-wrap:wrap">
        <span style="font-size:11px;color:#64748b">📍 ${c.state ?? "—"}, ${c.country ?? "—"}</span>
        <span style="font-size:11px;color:#64748b">📍 Extensão: ${ext}</span>
        ${tipos ? `<span style="font-size:11px;color:#64748b">🛠 ${tipos}</span>` : ""}
        ${c.clientName ? `<span style="font-size:11px;color:#64748b">🏢 ${c.clientName}</span>` : ""}
      </div>
      ${disciplineBlocks || '<p style="font-size:11px;color:#94a3b8">Nenhuma tarefa cadastrada.</p>'}
    </section>`;
  }).join("") : "";

  // Build map section using staticMapData (server-side Static Maps API)
  let mapImageHtml = "";
  if (staticMapData?.url) {
    mapImageHtml = `<section>
      <h3>Mapa de Contratos por Localização</h3>
      <img src="${staticMapData.url}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;margin-top:8px;max-height:400px;object-fit:cover" alt="Mapa de Contratos" />
      ${stateTableHtml}
    </section>
    <section style="margin-top:24px">
      <h3>Detalhamento dos Contratos</h3>
      ${contractDetailTable || '<p style="font-size:12px;color:#94a3b8">Nenhum contrato encontrado.</p>'}
    </section>`;
  } else if (mapContainerEl) {
    try {
      const canvas = await html2canvas(mapContainerEl, { useCORS: true, allowTaint: true, scale: 1.5, logging: false });
      const mapDataUrl = canvas.toDataURL("image/png");
      mapImageHtml = `<section>
        <h3>Mapa de Contratos por Localização</h3>
        <img src="${mapDataUrl}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;margin-top:8px" alt="Mapa de Contratos" />
        ${stateTableHtml}${contractDetailTable}
      </section>`;
    } catch {
      mapImageHtml = `<section><h3>Mapa de Contratos por Localização</h3><p style="color:#64748b;font-size:12px">Mapa não disponível na exportação.</p>${stateTableHtml}${contractDetailTable}</section>`;
    }
  } else {
    mapImageHtml = stateRows ? `<section>${stateTableHtml}${contractDetailTable}</section>` : "";
  }

  const finalHtml = html.replace("</div>\n\n  <div class=\"footer\"", `${mapImageHtml}\n  </div>\n\n  <div class=\"footer\"`);

  const win = window.open("", "_blank");
  if (!win) { toast.error("Popup bloqueado. Permita popups para exportar o PDF."); return; }
  win.document.write(finalHtml);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}

// ── Annual Report PDF Export ──────────────────────────────────────────────────
function exportAnnualReportPDF(report: any, clientName?: string) {
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const { year, summary, tasksByCrs, memberStats, disciplineStats, monthlyTrend } = report;
  const completionColor = summary.completionRate >= 80 ? '#10b981' : summary.completionRate >= 50 ? '#3b82f6' : '#f59e0b';

  const contractRows = (tasksByCrs ?? []).map((c: any) => {
    const pct = c.progress;
    const bar = `<div style="display:inline-block;width:${Math.max(pct, 2)}%;height:6px;background:${pct >= 80 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b'};border-radius:3px;max-width:80px"></div>`;
    return `<tr><td>${c.crsCode ? `<span style="font-size:10px;color:#64748b">[${c.crsCode}]</span> ` : ''}${c.crsName}</td><td style="text-align:center">${c.clientName}</td><td style="text-align:center">${c.totalTasks}</td><td style="text-align:center;color:#10b981">${c.completedTasks}</td><td style="text-align:center;color:#ef4444">${c.overdueTasks}</td><td>${bar} <span style="font-size:11px;color:#64748b">${pct}%</span></td></tr>`;
  }).join("");

  const memberRows = (memberStats ?? []).map((m: any) => {
    return `<tr><td>${m.userName}</td><td style="text-align:center">${m.totalTasks}</td><td style="text-align:center;color:#10b981">${m.completedTasks}</td><td style="text-align:center;color:#ef4444">${m.overdueTasks}</td><td style="text-align:right">${m.completionRate}%</td></tr>`;
  }).join("");

  const disciplineRows = (disciplineStats ?? []).map((d: any) => {
    return `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.color ?? '#6366f1'};margin-right:6px;vertical-align:middle"></span>${d.disciplineName}</td><td style="text-align:center">${d.totalTasks}</td><td style="text-align:center;color:#10b981">${d.completedTasks}</td><td style="text-align:right">${d.completionRate}%</td></tr>`;
  }).join("");

  const maxMonthVal = Math.max(...(monthlyTrend ?? []).map((m: any) => m.created), 1);
  const monthBars = (monthlyTrend ?? []).map((m: any) => {
    const h = Math.round((m.created / maxMonthVal) * 60);
    const hc = Math.round((m.completed / maxMonthVal) * 60);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
      <div style="font-size:9px;color:#64748b;min-height:12px">${m.created > 0 ? m.created : ''}</div>
      <div style="display:flex;align-items:flex-end;justify-content:center;height:64px;gap:1px;width:100%">
        <div style="width:45%;background:#3b82f6;border-radius:2px 2px 0 0;height:${h}px"></div>
        <div style="width:45%;background:#10b981;border-radius:2px 2px 0 0;height:${hc}px"></div>
      </div>
      <div style="font-size:9px;color:#94a3b8">${m.monthName}</div>
    </div>`;
  }).join("");

  const hasTrend = (monthlyTrend ?? []).some((m: any) => m.created > 0);

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Anual ${year}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; }
.header { background:linear-gradient(135deg,#1e3a5f 0%,#0f2744 100%); color:#fff; padding:24px 32px; display:flex; justify-content:space-between; align-items:center; }
.brand { font-size:22px; font-weight:800; color:#fff; }
.brand-sub { font-size:11px; color:rgba(255,255,255,0.55); margin-top:2px; }
.content { padding:28px 32px; }
h2 { font-size:18px; font-weight:700; color:#0f2744; margin-bottom:4px; }
.sub { font-size:12px; color:#64748b; margin-bottom:20px; }
h3 { font-size:12px; font-weight:700; color:#1e3a5f; margin:22px 0 8px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; padding-bottom:5px; }
.kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:16px 0; }
.kpi { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:center; }
.kpi-v { font-size:26px; font-weight:800; color:#0f2744; }
.kpi-l { font-size:11px; color:#64748b; margin-top:3px; }
.kpi-s { font-size:10px; color:#94a3b8; margin-top:1px; }
.bar-wrap { background:#e2e8f0; border-radius:6px; height:10px; overflow:hidden; margin:4px 0; }
.bar-fill { height:10px; border-radius:6px; background:${completionColor}; width:${summary.completionRate}%; }
table { width:100%; border-collapse:collapse; font-size:12px; margin-top:6px; }
th { background:#f1f5f9; color:#475569; font-weight:600; padding:7px 10px; text-align:left; font-size:11px; }
td { padding:6px 10px; border-bottom:1px solid #f1f5f9; color:#334155; }
tr:last-child td { border-bottom:none; }
.footer { background:#0f2744; color:rgba(255,255,255,0.6); padding:12px 32px; display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-top:32px; }
.footer-brand { font-weight:700; color:#fff; font-size:13px; }
@media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="header">
  <div><div class="brand">Orbita</div><div class="brand-sub">Gerenciamento de Projetos</div></div>
  <div style="text-align:right">
    <div style="font-size:14px;font-weight:700;color:#fff">Relatório Anual ${year}${clientName ? ` — ${clientName}` : ''}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px">Gerado em ${now}</div>
  </div>
</div>
<div class="content">
  <h2>Relatório Geral — ${year}</h2>
  <p class="sub">Resumo executivo de desempenho e progresso dos projetos${clientName ? ` para ${clientName}` : ' em todos os clientes'}.</p>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-v">${summary.totalContracts}</div><div class="kpi-l">Contratos</div><div class="kpi-s">${summary.activeContracts} ativos</div></div>
    <div class="kpi"><div class="kpi-v">${summary.totalTasks}</div><div class="kpi-l">Total de Tarefas</div></div>
    <div class="kpi"><div class="kpi-v" style="color:#10b981">${summary.completedTasks}</div><div class="kpi-l">Concluídas</div></div>
    <div class="kpi"><div class="kpi-v" style="color:#ef4444">${summary.overdueTasks}</div><div class="kpi-l">Em Atraso</div></div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:12px;font-weight:600;color:#1e3a5f">Taxa de Conclusão Geral</span>
      <span style="font-size:18px;font-weight:800;color:${completionColor}">${summary.completionRate}%</span>
    </div>
    <div class="bar-wrap"><div class="bar-fill"></div></div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#64748b">
      <span>✓ ${summary.completedTasks} concluídas</span>
      <span>⟳ ${summary.inProgressTasks} em andamento</span>
      <span>□ ${summary.pendingTasks} pendentes</span>
    </div>
  </div>
  ${hasTrend ? `<h3>Evolução Mensal</h3><div style="display:flex;gap:4px;align-items:flex-end;padding:8px 0">${monthBars}</div><div style="display:flex;gap:16px;font-size:10px;color:#64748b;margin-top:4px"><span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;border-radius:2px"></span>Criadas</span><span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px"></span>Concluídas</span></div>` : ''}
  ${contractRows ? `<h3>Desempenho por Contrato</h3><table><thead><tr><th>Contrato</th><th style="text-align:center">Cliente</th><th style="text-align:center">Tarefas</th><th style="text-align:center">Concluídas</th><th style="text-align:center">Em Atraso</th><th>Progresso</th></tr></thead><tbody>${contractRows}</tbody></table>` : ''}
  ${memberRows ? `<h3>Desempenho da Equipe</h3><table><thead><tr><th>Membro</th><th style="text-align:center">Tarefas</th><th style="text-align:center">Concluídas</th><th style="text-align:center">Em Atraso</th><th style="text-align:right">Taxa</th></tr></thead><tbody>${memberRows}</tbody></table>` : ''}
  ${disciplineRows ? `<h3>Tarefas por Disciplina / Setor</h3><table><thead><tr><th>Disciplina</th><th style="text-align:center">Tarefas</th><th style="text-align:center">Concluídas</th><th style="text-align:right">Taxa</th></tr></thead><tbody>${disciplineRows}</tbody></table>` : ''}
</div>
<div class="footer">
  <span class="footer-brand">Orbita</span>
  <span>Relatório Anual ${year} — Gerado em ${now}</span>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Popup bloqueado. Permita popups para exportar o PDF."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingAnnualYear, setExportingAnnualYear] = useState<number | null>(null);
  const [annualReportYear, setAnnualReportYear] = useState<number | null>(null);
  const [exportingWithMap, setExportingWithMap] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [filterClient, setFilterClient] = useState("all");
  const [selectedMapCrs, setSelectedMapCrs] = useState<any>(null);
  const [mapFilterCountry, setMapFilterCountry] = useState("all");
  const [mapFilterState, setMapFilterState] = useState("all");
  const [selectedStateGroup, setSelectedStateGroup] = useState<{ state: string; stateCode: string; countryCode: string; crsList: any[] } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const BRAZIL_GEOJSON_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/brazil-states_ea4aab25.geojson";

  const statsQ = trpc.dashboard.stats.useQuery({ clientId: filterClient === "all" ? undefined : Number(filterClient) });
  // conflictsQ removed - dashboard.conflicts not available
  const conflictsQ = { data: [] as any[], isLoading: false };
  const clientCountQ = trpc.dashboard.stats.useQuery({ clientId: undefined });
  const projectsQ = trpc.crs.list.useQuery();
  const sprintsQ = trpc.sprints.listByCrs.useQuery({ crsId: 0 }, { enabled: false });
  const recentQ = trpc.dashboard.weekDeliveries.useQuery();
  const myTasksQ = trpc.dashboard.myTasks.useQuery();
  const clientsQ = trpc.clients.list.useQuery();
  const clientProgressQ = trpc.dashboard.clientProgress.useQuery();
  const yearlyStatsQ = trpc.dashboard.yearlyStats.useQuery({ clientId: filterClient === "all" ? undefined : Number(filterClient) });
  const taskTrendQ = trpc.dashboard.taskTrend.useQuery({ clientId: filterClient === "all" ? undefined : Number(filterClient) });
  const activityLogsQ = trpc.dashboard.recentActivity.useQuery({ limit: 15 });
  const annualReportQ = trpc.dashboard.annualReport.useQuery(
    { year: annualReportYear ?? 0, clientId: filterClient === "all" ? undefined : Number(filterClient) },
    { enabled: annualReportYear !== null }
  );
  const staticMapQ = trpc.dashboard.staticMapUrl.useQuery(
    { clientId: filterClient === "all" ? undefined : Number(filterClient) },
    { enabled: exportingWithMap, staleTime: 60000 }
  );
  const contractsForPdfQ = trpc.dashboard.contractsForPdf.useQuery(
    { clientId: filterClient === "all" ? undefined : Number(filterClient) },
    { enabled: exportingWithMap, staleTime: 60000 }
  );
  const stats = statsQ.data;
  const conflicts = conflictsQ.data ?? [];
  const clientCount = statsQ.data?.totalClients ?? 0;
  const allCrs = (projectsQ.data ?? []) as any[];

  // Show onboarding for new users (no projects and hasn't dismissed before)
  useEffect(() => {
    if (!projectsQ.isLoading && allCrs.length === 0) {
      const dismissed = localStorage.getItem("onboarding_dismissed");
      if (!dismissed) setShowOnboarding(true);
    }
  }, [projectsQ.isLoading, allCrs.length]);

  function handleCloseOnboarding() {
    setShowOnboarding(false);
    localStorage.setItem("onboarding_dismissed", "1");
  }
  // Trigger PDF export when annual report data loads
  useEffect(() => {
    if (annualReportYear !== null && annualReportQ.data && exportingAnnualYear === annualReportYear) {
      const activeClient = filterClient !== "all" ? (clientsQ.data ?? []).find((c: any) => String(c.id) === filterClient) : null;
      exportAnnualReportPDF(annualReportQ.data, activeClient?.name);
      setExportingAnnualYear(null);
      setAnnualReportYear(null);
    }
  }, [annualReportQ.data, annualReportYear, exportingAnnualYear, filterClient, clientsQ.data]);

  // Trigger Dashboard PDF with map when staticMapQ and contractsForPdfQ load
  useEffect(() => {
    if (exportingWithMap && staticMapQ.data && !staticMapQ.isLoading && contractsForPdfQ.data && !contractsForPdfQ.isLoading) {
      const activeClient = filterClient !== "all" ? (clientsQ.data ?? []).find((c: any) => String(c.id) === filterClient) : null;
      exportDashboardPDF({
        stats,
        projects,
        sprints,
        recentTasks,
        conflicts,
        clientCount,
        overdueP,
        completedP,
        revisionP: 0,
        onTimeP,
        staticMapData: staticMapQ.data,
        contractsDetail: contractsForPdfQ.data,
        clientName: activeClient?.name,
        clientColor: activeClient?.color,
      });
      setExportingWithMap(false);
      setExportingPdf(false);
    }
  }, [exportingWithMap, staticMapQ.data, staticMapQ.isLoading, contractsForPdfQ.data, contractsForPdfQ.isLoading]);
  const clients = (clientsQ.data ?? []) as any[];
  // Filter projects by selected client
  const projects = filterClient === "all"
    ? allCrs
    : allCrs.filter((p: any) => String(p.clientId ?? "") === filterClient);
  const sprints = (sprintsQ.data ?? []) as any[];
  const recentTasks = (recentQ.data ?? []) as any[];
  const myTasksList = (myTasksQ.data ?? []) as any[];

  // Current week sprints
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekSprints = useMemo(() =>
    sprints.filter((s: any) => {
      const start = s.startDate ? new Date(s.startDate) : null;
      const end = s.endDate ? new Date(s.endDate) : null;
      if (!start || !end) return false;
      return start <= weekEnd && end >= weekStart;
    }),
    [sprints]
  );

  // Percentages
  const total = stats?.totalTasks ?? 0;
  const overdueP = pct(stats?.overdueTasks ?? 0, total);
  const completedP = pct(stats?.completedTasks ?? 0, total);
  const onTimeP = total > 0 ? Math.max(0, 100 - overdueP) : 0;
  // Checklist KPIs
  const checklistTotal = stats?.totalChecklist ?? 0;
  const checklistCompletedP = checklistTotal > 0 ? Math.round(((stats?.completedChecklist ?? 0) / checklistTotal) * 100) : 0;

  // Donut data
  const donutData = [
    { name: STATUS_LABELS.pending,     value: stats?.pendingTasks ?? 0,    color: STATUS_COLORS.pending },
    { name: STATUS_LABELS.in_progress, value: stats?.inProgressTasks ?? 0, color: STATUS_COLORS.in_progress },
    { name: STATUS_LABELS.published,   value: stats?.completedTasks ?? 0,  color: STATUS_COLORS.published },
  ].filter(d => d.value > 0);

  const isLoading = statsQ.isLoading;

  // Build CRS map markers grouped by state/country
  function buildMapMarkers(map: google.maps.Map, crsData: any[], filterCountry: string, filterState: string) {
    markersRef.current.forEach((m: any) => { try { m.map = null; } catch {} });
    markersRef.current = [];
    const filtered = crsData.filter((c: any) => {
      if (!c.countryCode) return false;
      if (filterCountry !== "all" && c.countryCode !== filterCountry) return false;
      if (filterState !== "all" && c.stateCode !== filterState) return false;
      return true;
    });
    // Group by state (or country if no state)
    const groups: Record<string, { lat: number; lng: number; crsList: any[]; label: string; stateCode: string; countryCode: string; state: string }> = {};
    filtered.forEach((crs: any) => {
      const key = crs.stateCode ? `${crs.countryCode}-${crs.stateCode}` : crs.countryCode;
      if (!groups[key]) {
        let lat = 0, lng = 0, label = "";
        if (crs.stateCode) {
          const states = getStatesForCountry(crs.countryCode);
          const st = states.find(s => s.code === crs.stateCode);
          lat = st?.lat ?? getCountryByCode(crs.countryCode)?.lat ?? 0;
          lng = st?.lng ?? getCountryByCode(crs.countryCode)?.lng ?? 0;
          label = st?.name ?? crs.state ?? crs.stateCode;
        } else {
          const country = getCountryByCode(crs.countryCode);
          lat = country?.lat ?? 0;
          lng = country?.lng ?? 0;
          label = country?.name ?? crs.countryCode;
        }
        groups[key] = { lat, lng, crsList: [], label, stateCode: crs.stateCode ?? "", countryCode: crs.countryCode, state: crs.state ?? crs.stateCode ?? "" };
      }
      groups[key].crsList.push(crs);
    });
    Object.values(groups).forEach((group) => {
      if (!group.lat && !group.lng) return;
      const count = group.crsList.length;
      const pin = document.createElement("div");
      const pinColor = getPinColor(group.crsList);
      pin.style.cssText = `min-width:32px;height:32px;border-radius:16px;background:${pinColor};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;padding:0 8px;gap:4px;`;
      pin.innerHTML = `<span>${count}</span>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat: group.lat, lng: group.lng }, title: group.label, content: pin });
      marker.addListener("click", () => {
        if (count === 1) {
          setSelectedMapCrs(group.crsList[0]);
          setSelectedStateGroup(null);
        } else {
          setSelectedStateGroup({ state: group.label, stateCode: group.stateCode, countryCode: group.countryCode, crsList: group.crsList });
          setSelectedMapCrs(null);
        }
        map.panTo({ lat: group.lat, lng: group.lng });
        map.setZoom(group.stateCode ? 6 : 4);
      });
      markersRef.current.push(marker);
    });
  }
  function buildStateColors(map: google.maps.Map, crsData: any[]) {
    // Only color Brazilian states
    const brCrs = crsData.filter((c: any) => c.countryCode === "BR" && c.stateCode);
    // Count contracts per state
    const stateCount: Record<string, number> = {};
    brCrs.forEach((c: any) => {
      stateCount[c.stateCode] = (stateCount[c.stateCode] ?? 0) + 1;
    });
    const maxCount = Math.max(...Object.values(stateCount), 1);
    // Remove previous data layer
    if (dataLayerRef.current) {
      dataLayerRef.current.setMap(null);
      dataLayerRef.current = null;
    }
    if (brCrs.length === 0) return;
    // Load GeoJSON and apply colors
    const dataLayer = new google.maps.Data({ map });
    dataLayerRef.current = dataLayer;
    dataLayer.loadGeoJson(BRAZIL_GEOJSON_URL, undefined, () => {
      dataLayer.setStyle((feature) => {
        const sigla = feature.getProperty("sigla") as string;
        const count = stateCount[sigla] ?? 0;
        if (count === 0) {
          return { fillColor: "#1e293b", fillOpacity: 0.15, strokeColor: "#334155", strokeWeight: 0.8 };
        }
        // Gradient: light blue → deep blue based on count
        const intensity = Math.min(count / maxCount, 1);
        const r = Math.round(59 + (29 - 59) * intensity);
        const g = Math.round(130 + (78 - 130) * intensity);
        const b = Math.round(246 + (216 - 246) * intensity);
        return {
          fillColor: `rgb(${r},${g},${b})`,
          fillOpacity: 0.35 + intensity * 0.45,
          strokeColor: "#60a5fa",
          strokeWeight: 1,
        };
      });
      dataLayer.addListener("click", (event: any) => {
        const sigla = event.feature.getProperty("sigla") as string;
        const name = event.feature.getProperty("name") as string;
        const crsList = brCrs.filter((c: any) => c.stateCode === sigla);
        if (crsList.length > 0) {
          setSelectedStateGroup({ state: name, stateCode: sigla, countryCode: "BR", crsList });
          setSelectedMapCrs(null);
        }
      });
    });
  }
  function initMapMarkers(map: google.maps.Map) {
    mapRef.current = map;
    buildMapMarkers(map, allCrs, mapFilterCountry, mapFilterState);
    buildStateColors(map, allCrs);
  }
  // Rebuild markers and state colors when filters or data change
  useEffect(() => {
    if (mapRef.current) {
      buildMapMarkers(mapRef.current, allCrs, mapFilterCountry, mapFilterState);
      buildStateColors(mapRef.current, allCrs);
    }
  }, [mapFilterCountry, mapFilterState, allCrs]);

  // ── Activity log helpers ─────────────────────────────────────────────────────
  const activityLogs = (activityLogsQ.data ?? []) as any[];
  const taskTrendData = (taskTrendQ.data ?? []) as any[];
  // Show only last 7 days of trend for mini chart (less clutter)
  const trendLast7 = taskTrendData.slice(-7);

  // ── Mini-calendar: week tasks (from recentQ — tasks due this week) ────────────
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayDow = now.getDay();
  const calDays = weekDays.map((label, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dStr = d.toDateString();
    const tasksOnDay = recentTasks.filter((t: any) => t.dueDate && new Date(t.dueDate).toDateString() === dStr);
    return { label, date: d, tasks: tasksOnDay, isToday: i === todayDow };
  });

  // ── Action labels for activity log ───────────────────────────────────────────
  const ACTION_LABELS: Record<string, string> = {
    created_task: "Criou tarefa", updated_task: "Atualizou tarefa", deleted_task: "Excluiu tarefa",
    created_crs: "Criou contrato", updated_crs: "Atualizou contrato", deleted_crs: "Excluiu contrato",
    created_client: "Criou cliente", updated_client: "Atualizou cliente",
    created_checklist: "Adicionou checklist", updated_checklist: "Atualizou checklist",
    user_login: "Fez login", user_logout: "Saiu",
  };

  return (
    <AppLayout title="Dashboard">
      <OnboardingWizard open={showOnboarding} onClose={handleCloseOnboarding} />
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Acompanhamento dos Projetos</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {clients.length > 0 && (
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="gap-2" disabled={exportingPdf || exportingWithMap || isLoading}
              onClick={() => {
                setExportingPdf(true);
                setExportingWithMap(true);
              }}>
              <FileDown className="w-4 h-4" />
              {(exportingPdf || exportingWithMap) ? "Gerando..." : "Exportar PDF"}
            </Button>
          </div>
        </div>

        {/* ── KPI Cards Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Contratos Ativos",  value: projects.length,              icon: FolderKanban, gradient: "from-[#785500] to-[#b07d00]",   text: "text-white" },
            { label: "Total de Tarefas",  value: total,                        icon: Layers,       gradient: "from-[#1a7a4a] to-[#22c55e]",   text: "text-white" },
            { label: "Tarefas em Atraso", value: stats?.overdueTasks ?? 0,     icon: AlertTriangle, gradient: "from-[#b91c1c] to-[#ef4444]",  text: "text-white" },
            { label: "Clientes",          value: clientCount,                  icon: Briefcase,    gradient: "from-[#c2410c] to-[#f97316]",   text: "text-white" },
          ].map(({ label, value, icon: Icon, gradient, text }) => (
            <div key={label} className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 shadow-md`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-medium ${text} opacity-80 mb-1`}>{label}</p>
                  {isLoading ? <Skeleton className="h-8 w-16 bg-white/20" /> : (
                    <p className={`text-3xl font-bold ${text}`}>{value}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${text}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Gauge KPIs (progress rings) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
          ) : (
            <>
              <GaugeCard label="Tarefas em Atraso"   value={overdueP}            inverted={true}  description={`${stats?.overdueTasks ?? 0} de ${total} tarefas em atraso`} />
              <GaugeCard label="Tarefas Concluídas"  value={completedP}                           description={`${stats?.completedTasks ?? 0} de ${total} tarefas concluídas`} />
              <GaugeCard label="Checklist Concluído" value={checklistCompletedP}                   description={`${stats?.completedChecklist ?? 0} de ${checklistTotal} itens`} />
              <GaugeCard label="Entregues no Prazo"   value={onTimeP}                              description={`${total - (stats?.overdueTasks ?? 0)} de ${total} tarefas no prazo`} />
            </>
          )}
        </div>

        {/* ── Dados Técnicos KPIs (conditional) ── */}
        {!isLoading && allCrs.some((c: any) => c.extensaoKm || c.areaHa || c.perimetroUrbano) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Extensão Total", value: allCrs.reduce((s: number, c: any) => s + (Number(c.extensaoKm) || 0), 0).toFixed(1) + " km", icon: Ruler, color: "text-amber-600", bg: "bg-amber-500/10" },
              { label: "Área Total", value: allCrs.reduce((s: number, c: any) => s + (Number(c.areaHa) || 0), 0).toFixed(0) + " m²", icon: MapPin, color: "text-violet-400", bg: "bg-violet-500/10" },
              { label: "Perímetros Urbanos", value: allCrs.reduce((s: number, c: any) => s + (Number(c.perimetroUrbano) || 0), 0), icon: Building2, color: "text-orange-400", bg: "bg-orange-500/10" },
              { label: "Com Dados Técnicos", value: `${allCrs.filter((c: any) => c.extensaoKm || c.areaHa || c.perimetroUrbano).length}/${allCrs.length}`, icon: FolderKanban, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="text-2xl font-bold text-foreground">{value}</p></div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${color}`} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Main Content Row: Line Chart + Mini Calendar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Line Chart — últimos 30 dias */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                Histórico de Tarefas — Últimos 30 Dias
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Concluídas</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" />Em Atraso</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" />Criadas</span>
              </div>
            </div>
            {taskTrendQ.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={taskTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOverdue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    interval={Math.floor(taskTrendData.length / 6)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { completed: "Concluídas", overdue: "Em Atraso", created: "Criadas" };
                      return [value, labels[name] ?? name];
                    }}
                  />
                  <Area type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} fill="url(#gradCompleted)" dot={false} />
                  <Area type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} fill="url(#gradOverdue)" dot={false} />
                  <Area type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} fill="url(#gradCreated)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Mini Calendar — programação da semana */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-600" />
              Programação da Semana
            </h3>
            <div className="space-y-1.5">
              {calDays.map(({ label, date, tasks: dayTasks, isToday }) => (
                <div key={label}
                  className={`flex items-start gap-3 p-2 rounded-xl transition-colors ${
                    isToday ? "bg-amber-500/10 border border-amber-500/20" : "hover:bg-muted/40"
                  }`}>
                  <div className={`w-8 text-center flex-shrink-0 ${
                    isToday ? "text-amber-600" : "text-muted-foreground"
                  }`}>
                    <p className="text-[10px] font-medium">{label}</p>
                    <p className={`text-lg font-bold leading-tight ${
                      isToday ? "text-amber-600" : "text-foreground"
                    }`}>{date.getDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 mt-1">Sem entregas</p>
                    ) : (
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 2).map((t: any) => (
                          <div key={t.id} className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate(`/tasks/${t.id}`)}>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[t.status] ?? "#94a3b8" }} />
                            <p className="text-xs text-foreground truncate">{t.title}</p>
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <p className="text-[10px] text-muted-foreground">+{dayTasks.length - 2} mais</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Donut + Tipo de Obra + Progresso por Cliente ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Donut */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              Status das Atividades
            </h3>
            {isLoading ? <Skeleton className="h-52 w-full" /> : donutData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" labelLine={false} label={CustomLabel}>
                      {donutData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: number, name: string) => [`${value} tarefas`, name]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute pointer-events-none" style={{ top: "38%", left: "50%", transform: "translate(-50%, -50%)" }}>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{total}</p>
                    <p className="text-xs text-muted-foreground">tarefas</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tipo de Obra Bar Chart */}
          {!isLoading && allCrs.length > 0 && (() => {
            const countMap: Record<string, number> = {};
            for (const c of allCrs) {
              const types = parseTipoObra(c.tipoObra);
              if (types.length === 0) { countMap["outro"] = (countMap["outro"] ?? 0) + 1; }
              else { for (const t of types) { countMap[t] = (countMap[t] ?? 0) + 1; } }
            }
            const chartData = Object.entries(countMap)
              .map(([key, count]) => ({ name: TIPO_OBRA_MAP[key] ?? key, count, color: TIPO_OBRA_COLOR[key] ?? "#94a3b8" }))
              .sort((a, b) => b.count - a.count);
            if (chartData.length === 0) return null;
            return (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                  Contratos por Tipo de Obra
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <RechartsTooltip formatter={(value: number) => [`${value} contrato${value !== 1 ? "s" : ""}`, "Total"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {chartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground truncate">{d.name}</p>
                        <p className="text-sm font-bold text-foreground">{d.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Progresso por Cliente */}
          {(clientProgressQ.data ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-orange-400" />
                Progresso por Cliente
              </h3>
              <div className="space-y-3">
                {(clientProgressQ.data ?? []).slice(0, 5).map((c: any) => {
                  const isActive = filterClient === String(c.id);
                  return (
                    <button key={c.id} onClick={() => setFilterClient(isActive ? "all" : String(c.id))}
                      className={`w-full space-y-1 text-left rounded-xl p-2 -m-2 transition-all border-2 ${
                        isActive ? "bg-muted/60" : "border-transparent hover:bg-muted/40"
                      }`}
                      style={isActive ? { borderColor: c.color ?? "#785500" } : { borderColor: "transparent" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? "#785500" }} />
                          <span className="text-xs font-medium truncate">{c.name}</span>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: c.color ?? "#785500" }}>{c.avgProgress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${c.avgProgress}%`, backgroundColor: c.color ?? "#785500" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Map + Recent Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* World Map — metade da tela */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-base">🌍</span>
                Mapa de Contratos
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={mapFilterCountry} onValueChange={(v) => { setMapFilterCountry(v); setMapFilterState("all"); }}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Todos os países" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os países</SelectItem>
                    {Array.from(new Set(allCrs.filter((c: any) => c.countryCode).map((c: any) => c.countryCode))).map((code: any) => {
                      const country = getCountryByCode(code);
                      return <SelectItem key={code} value={code}>{country?.flag ?? ""} {country?.name ?? code}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {mapFilterCountry !== "all" && getStatesForCountry(mapFilterCountry).length > 0 && (
                  <Select value={mapFilterState} onValueChange={setMapFilterState}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Todos os estados" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os estados</SelectItem>
                      {getStatesForCountry(mapFilterCountry)
                        .filter(st => allCrs.some((c: any) => c.countryCode === mapFilterCountry && c.stateCode === st.code))
                        .map((st) => <SelectItem key={st.code} value={st.code}>{st.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="relative" ref={mapContainerRef}>
              <div className="rounded-xl overflow-hidden" style={{ height: 300 }}>
                <MapView initialCenter={{ lat: 10, lng: 0 }} initialZoom={2} onMapReady={initMapMarkers} />
              </div>
              {/* Legenda */}
              <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-1.5 shadow-md z-10">
                <div className="space-y-0.5">
                  {Object.entries(TIPO_OBRA_MAP).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TIPO_OBRA_COLOR[key] }} />
                      <span className="text-[9px] text-foreground/80">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Popup individual */}
              {selectedMapCrs && (
                <div className="absolute top-2 right-2 bg-card border border-border rounded-xl p-3 shadow-lg max-w-52 z-10">
                  <button className="absolute top-1 right-1.5 text-muted-foreground hover:text-foreground text-xs" onClick={() => setSelectedMapCrs(null)}>✕</button>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedMapCrs.clientColor ?? "#785500" }} />
                    <p className="text-sm font-semibold truncate pr-4">{selectedMapCrs.name}</p>
                  </div>
                  {selectedMapCrs.code && <p className="text-xs font-mono text-amber-700 mb-1">{selectedMapCrs.code}</p>}
                  {selectedMapCrs.clientName && <p className="text-xs text-muted-foreground">Cliente: {selectedMapCrs.clientName}</p>}
                  {selectedMapCrs.countryCode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getCountryByCode(selectedMapCrs.countryCode)?.flag ?? ""} {getCountryByCode(selectedMapCrs.countryCode)?.name ?? selectedMapCrs.countryCode}
                      {selectedMapCrs.state ? ` — ${selectedMapCrs.state}` : ""}
                    </p>
                  )}
                  {parseTipoObra(selectedMapCrs.tipoObra).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">Tipo: {parseTipoObra(selectedMapCrs.tipoObra).map((t: string) => TIPO_OBRA_MAP[t] ?? t).join(", ")}</p>
                  )}
                  <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{Math.round(selectedMapCrs.progress ?? 0)}% concluído</span>
                    <button className="text-xs text-amber-700 hover:underline" onClick={() => navigate(`/kanban?crs=${selectedMapCrs.id}`)}>Ver Kanban →</button>
                  </div>
                </div>
              )}
              {/* Popup grupo de estado */}
              {selectedStateGroup && (
                <div className="absolute top-2 right-2 bg-card border border-border rounded-xl p-3 shadow-lg max-w-60 z-10">
                  <button className="absolute top-1 right-1.5 text-muted-foreground hover:text-foreground text-xs" onClick={() => setSelectedStateGroup(null)}>✕</button>
                  <p className="text-sm font-semibold mb-2 pr-4">
                    {getCountryByCode(selectedStateGroup.countryCode)?.flag ?? ""} {selectedStateGroup.state}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">({selectedStateGroup.crsList.length} contratos)</span>
                  </p>
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {selectedStateGroup.crsList.map((crs: any) => (
                      <button key={crs.id} onClick={() => { setSelectedMapCrs(crs); setSelectedStateGroup(null); }}
                        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: crs.clientColor ?? "#785500" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{crs.name}</p>
                          {crs.code && <p className="text-xs text-muted-foreground font-mono">{crs.code}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{Math.round(crs.progress ?? 0)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {allCrs.filter((c: any) => c.countryCode).length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">Adicione país/estado aos Contratos para visualizá-los no mapa</p>
            )}
          </div>

          {/* Últimas Atualizações */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Últimas Atualizações
            </h3>
            {activityLogsQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : activityLogs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Clock className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto max-h-72">
                {activityLogs.map((log: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-amber-600">
                        {(log.userName ?? "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">{log.userName ?? "Usuário"}</span>
                        {" "}
                        <span className="text-muted-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
                        {log.entityName ? <span className="font-medium"> "{log.entityName}"</span> : null}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Row: My Tasks + Active Projects ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Minhas Tarefas */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Minhas Tarefas
            </h3>
            {myTasksQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !myTasksList.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída</p>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto max-h-64">
                {myTasksList.map((t: any) => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "published" && t.status !== "archived";
                  const statusColor = STATUS_COLORS[t.status] ?? STATUS_COLORS.pending;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 cursor-pointer transition-colors" onClick={() => navigate(`/tasks/${t.id}`)}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.projectName ?? "Projeto"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-xs text-muted-foreground">{STATUS_LABELS[t.status] ?? t.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Projetos Ativos */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-violet-400" />
              Projetos Ativos
            </h3>
            {projectsQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : !projects.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FolderKanban className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum projeto ainda</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-64">
                {projects.slice(0, 8).map((p: any) => {
                  const ppct = Math.round(p.progress ?? 0);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/40 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${p.id}`)}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${p.color ?? "#3b82f6"}20` }}>
                        <FolderKanban className="w-4 h-4" style={{ color: p.color ?? "#3b82f6" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 bg-muted rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${ppct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{ppct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Visão Anual (collapsible) ── */}
        {(yearlyStatsQ.data ?? []).length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              Visão Anual
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Ano</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Contratos</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Tarefas</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Concluídas</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Em Andamento</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Em Atraso</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Checklist</th>
                    <th className="py-2 pl-3 text-muted-foreground font-medium">Progresso</th>
                    <th className="py-2 pl-3 text-muted-foreground font-medium text-center">Exportar</th>
                  </tr>
                </thead>
                <tbody>
                  {(yearlyStatsQ.data ?? []).map((y: any) => {
                    const yPct = y.totalTasks > 0 ? Math.round((y.completedTasks / y.totalTasks) * 100) : 0;
                    const isCurrentYear = y.year === new Date().getFullYear();
                    const isExporting = exportingAnnualYear === y.year;
                    return (
                      <tr key={y.year} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isCurrentYear ? 'bg-blue-500/5' : ''}`}>
                        <td className="py-3 pr-4">
                          <span className={`font-bold text-base ${isCurrentYear ? 'text-amber-600' : 'text-foreground'}`}>{y.year}</span>
                          {isCurrentYear && <span className="ml-2 text-xs bg-blue-500/20 text-amber-600 px-1.5 py-0.5 rounded-full">Atual</span>}
                        </td>
                        <td className="text-right py-3 px-3 text-foreground font-medium">{y.totalCrs}</td>
                        <td className="text-right py-3 px-3 text-foreground">{y.totalTasks}</td>
                        <td className="text-right py-3 px-3 text-emerald-400 font-medium">{y.completedTasks}</td>
                        <td className="text-right py-3 px-3 text-amber-600">{y.inProgressTasks}</td>
                        <td className="text-right py-3 px-3 text-red-400">{y.overdueTasks}</td>
                        <td className="text-right py-3 px-3 text-violet-400">{y.totalChecklist}</td>
                        <td className="py-3 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 min-w-[80px]">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${yPct}%`, backgroundColor: yPct >= 80 ? '#10b981' : yPct >= 50 ? '#3b82f6' : '#f59e0b' }} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground w-8 text-right">{yPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 pl-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            disabled={isExporting}
                            onClick={() => {
                              setExportingAnnualYear(y.year);
                              setAnnualReportYear(y.year);
                              toast.info(`Carregando relatório de ${y.year}...`);
                            }}
                          >
                            {isExporting ? (
                              <span className="animate-spin">&#8635;</span>
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            PDF
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
