import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, CircleDot, Gauge, Layers3, LineChart as LineChartIcon, ShieldAlert, Target, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DashboardPeriodBadge } from "./DashboardPeriodBadge";

export type DashboardOkrStats = {
  avgProgress?: number;
  totalCrs?: number;
  totalTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
  checklistProgress?: number;
  totalChecklist?: number;
  totalExtensaoKm?: number;
  extensaoByTipo?: Record<string, number>;
};

type OkrSla = {
  slaThis?: number | null;
  totalThis?: number;
  onTimeThis?: number;
  history?: Array<{ label: string; value: number | null }>;
};

type OkrContract = {
  id: number;
  name: string;
  code?: string | null;
  taskCount?: number;
  completedTaskCount?: number;
  checklistCount?: number;
  completedChecklistCount?: number;
  disciplineSummary?: Array<{ discipline?: string | null; taskCount?: number; checklistCount?: number; completedChecklistCount?: number }>;
};

type OkrMember = {
  userId: number;
  userName?: string | null;
  total?: number;
  completed?: number;
  overdue?: number;
  blocked?: number;
  completionRate?: number;
};

type OkrTab = "saude" | "resultados" | "tendencia" | "riscos";

type DashboardOkrBoxProps = {
  stats?: DashboardOkrStats;
  sla?: OkrSla;
  contracts: OkrContract[];
  members: OkrMember[];
  periodLabel: string;
  isLoading?: boolean;
  onNavigate: (path: string) => void;
};

const STATUS_COLORS = { healthy: "#16a34a", attention: "#f59e0b", critical: "#ef4444", neutral: "#94a3b8" } as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function completionRate(completed: number, total: number) {
  return total > 0 ? clamp((completed / total) * 100) : 0;
}

function getStatus(value: number, hasData = true) {
  if (!hasData) return { key: "neutral" as const, label: "Sem dados", color: STATUS_COLORS.neutral };
  if (value >= 80) return { key: "healthy" as const, label: "No caminho", color: STATUS_COLORS.healthy };
  if (value >= 50) return { key: "attention" as const, label: "Atenção", color: STATUS_COLORS.attention };
  return { key: "critical" as const, label: "Crítico", color: STATUS_COLORS.critical };
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${clamp(value)}%`;
}

function formatKm(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function getContractProgress(contract: OkrContract) {
  const taskCount = Number(contract.taskCount ?? 0);
  if (taskCount > 0) return completionRate(Number(contract.completedTaskCount ?? 0), taskCount);
  const checklistCount = Number(contract.checklistCount ?? 0);
  return checklistCount > 0 ? completionRate(Number(contract.completedChecklistCount ?? 0), checklistCount) : 0;
}

export function DashboardOkrBox({ stats, sla, contracts, members, periodLabel, isLoading = false, onNavigate }: DashboardOkrBoxProps) {
  const [activeTab, setActiveTab] = useState<OkrTab>("saude");

  const model = useMemo(() => {
    const totalTasks = Number(stats?.totalTasks ?? 0);
    const completedTasks = Number(stats?.completedTasks ?? 0);
    const overdueTasks = Number(stats?.overdueTasks ?? 0);
    const taskCompletion = completionRate(completedTasks, totalTasks);
    const checklistProgress = clamp(Number(stats?.checklistProgress ?? 0));
    const contractProgress = clamp(Number(stats?.avgProgress ?? 0));
    const slaValue = typeof sla?.slaThis === "number" ? clamp(sla.slaThis) : null;

    const objectives = [
      { id: "contracts", label: "Execução dos contratos", value: contractProgress, target: 100, description: "Progresso médio dos contratos ativos", status: getStatus(contractProgress, Number(stats?.totalCrs ?? 0) > 0) },
      { id: "tasks", label: "Entrega das tarefas", value: taskCompletion, target: 100, description: "Tarefas concluídas sobre o total", status: getStatus(taskCompletion, totalTasks > 0) },
      { id: "checklist", label: "Qualidade dos checklists", value: checklistProgress, target: 100, description: "Itens de checklist concluídos", status: getStatus(checklistProgress, Number(stats?.totalChecklist ?? 0) > 0) },
      { id: "sla", label: "Pontualidade operacional", value: slaValue, target: 90, description: "SLA de conclusões no período", status: getStatus(slaValue ?? 0, slaValue !== null) },
    ];

    const riskContracts = contracts
      .map((contract) => ({ ...contract, progress: getContractProgress(contract) }))
      .filter((contract) => contract.progress < 60)
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 6);

    const disciplineMap = new Map<string, { discipline: string; total: number; completed: number }>();
    contracts.forEach((contract) => (contract.disciplineSummary ?? []).forEach((item) => {
      const discipline = item.discipline?.trim() || "Sem disciplina";
      const current = disciplineMap.get(discipline) ?? { discipline, total: 0, completed: 0 };
      current.total += Number(item.checklistCount ?? item.taskCount ?? 0);
      current.completed += Number(item.completedChecklistCount ?? 0);
      disciplineMap.set(discipline, current);
    }));
    const disciplineData = Array.from(disciplineMap.values())
      .map((item) => ({ ...item, progress: completionRate(item.completed, item.total) }))
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 6);

    const typeData = Object.entries(stats?.extensaoByTipo ?? {})
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const trendData = (sla?.history ?? []).filter((point) => typeof point.value === "number").map((point) => ({ name: point.label, value: point.value }));
    const responsibleData = members
      .filter((member) => Number(member.total ?? 0) > 0)
      .map((member) => ({
        name: member.userName?.trim() || "Sem nome",
        completion: Number(member.completionRate ?? completionRate(Number(member.completed ?? 0), Number(member.total ?? 0))),
        overdue: Number(member.overdue ?? 0),
        total: Number(member.total ?? 0),
      }))
      .sort((a, b) => b.completion - a.completion)
      .slice(0, 6);

    const healthData = objectives.reduce<Record<string, number>>((acc, item) => {
      acc[item.status.key] = (acc[item.status.key] ?? 0) + 1;
      return acc;
    }, {});

    return { objectives, riskContracts, disciplineData, typeData, trendData, responsibleData, healthData, overdueTasks, totalTasks, slaValue };
  }, [contracts, members, sla, stats]);

  const tabs: Array<{ id: OkrTab; label: string; icon: typeof Target }> = [
    { id: "saude", label: "Saúde", icon: Gauge },
    { id: "resultados", label: "Resultados-chave", icon: BarChart3 },
    { id: "tendencia", label: "Tendência", icon: LineChartIcon },
    { id: "riscos", label: "Riscos e capacidade", icon: ShieldAlert },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" data-okr-box="true" aria-labelledby="dashboard-okr-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="h-5 w-5 text-teal-600 dark:text-teal-300" aria-hidden="true" />
            <h2 id="dashboard-okr-title" className="text-base font-bold text-slate-900 dark:text-slate-100">OKRs do período</h2>
            <DashboardPeriodBadge label={periodLabel} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Objetivos estratégicos, execução, riscos e capacidade de entrega em uma única visão.</p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Visões dos OKRs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500", activeTab === id ? "bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-teal-200" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100")}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-4" role="status" aria-live="polite" aria-label="Carregando indicadores de OKR">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {activeTab === "saude" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Saúde dos objetivos</h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{model.objectives.length} objetivos</span>
                </div>
                <div className="h-40" aria-label="Distribuição da saúde dos objetivos">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "No caminho", value: model.healthData.healthy ?? 0, color: STATUS_COLORS.healthy }, { name: "Atenção", value: model.healthData.attention ?? 0, color: STATUS_COLORS.attention }, { name: "Crítico", value: model.healthData.critical ?? 0, color: STATUS_COLORS.critical }, { name: "Sem dados", value: model.healthData.neutral ?? 0, color: STATUS_COLORS.neutral }].filter((item) => item.value > 0)} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={3}>
                        {[STATUS_COLORS.healthy, STATUS_COLORS.attention, STATUS_COLORS.critical, STATUS_COLORS.neutral].map((color) => <Cell key={color} fill={color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} objetivo(s)`, "Quantidade"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />No caminho: {model.healthData.healthy ?? 0}</span>
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Atenção: {model.healthData.attention ?? 0}</span>
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Crítico: {model.healthData.critical ?? 0}</span>
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" />Sem dados: {model.healthData.neutral ?? 0}</span>
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                {model.objectives.map((objective) => (
                  <button key={objective.id} type="button" onClick={() => setActiveTab("resultados")} className="w-full rounded-xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700 dark:hover:bg-teal-950/20" aria-label={`${objective.label}: ${formatPercent(objective.value)}, status ${objective.status.label}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{objective.label}</span>
                      <span className="shrink-0 text-xs font-bold" style={{ color: objective.status.color }}>{formatPercent(objective.value)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full transition-all" style={{ width: `${objective.value ?? 0}%`, backgroundColor: objective.status.color }} /></div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400"><span>{objective.description}</span><span>{objective.status.label}</span></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "resultados" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">KRs por disciplina</h3><span className="text-[10px] text-slate-500">Menor avanço primeiro</span></div>
                {model.disciplineData.length === 0 ? <p className="py-10 text-center text-xs text-slate-500">Ainda não há dados de disciplina para este período.</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={model.disciplineData} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} /><YAxis dataKey="discipline" type="category" width={88} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => [`${value}%`, "Progresso"]} /><Bar dataKey="progress" fill="#0d9488" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>}
              </div>
              <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Extensão por tipo de obra</h3><button type="button" onClick={() => onNavigate("/projects")} className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 hover:underline dark:text-teal-300">Ver contratos <ArrowRight className="h-3 w-3" aria-hidden="true" /></button></div>
                {model.typeData.length === 0 ? <p className="py-10 text-center text-xs text-slate-500">Nenhuma extensão cadastrada no período.</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={model.typeData} margin={{ bottom: 22 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => [formatKm(Number(value)), "Extensão"]} /><Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
              </div>
            </div>
          )}

          {activeTab === "tendencia" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Realizado versus meta de pontualidade</h3><span className="text-xs font-bold text-teal-700 dark:text-teal-300">Meta: 90%</span></div>
                {model.trendData.length < 2 ? <p className="py-16 text-center text-xs text-slate-500">Histórico insuficiente para calcular a tendência do período.</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={model.trendData} margin={{ left: 0, right: 12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => [`${value}%`, "SLA"]} /><Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={3} dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div>}
              </div>
              <div className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Resumo da meta</h3>
                <div className="rounded-lg bg-teal-50 p-3 dark:bg-teal-950/30"><p className="text-[10px] text-teal-700 dark:text-teal-300">Pontualidade atual</p><p className="mt-1 text-2xl font-black text-teal-800 dark:text-teal-200">{formatPercent(model.slaValue)}</p><p className="mt-1 text-[10px] text-teal-700/80 dark:text-teal-300/80">{sla?.onTimeThis ?? 0} de {sla?.totalThis ?? 0} conclusões no prazo</p></div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-slate-500 dark:text-slate-400">Tarefas em atraso</p><p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">{model.overdueTasks}</p><button type="button" onClick={() => onNavigate("/kanban")} className="mt-1 text-[10px] font-semibold text-teal-700 hover:underline dark:text-teal-300">Abrir Kanban</button></div>
              </div>
            </div>
          )}

          {activeTab === "riscos" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Contratos em risco</h3><span className="text-[10px] text-slate-500">Progresso abaixo de 60%</span></div>
                {model.riskContracts.length === 0 ? <div className="flex min-h-40 flex-col items-center justify-center text-center"><CheckCircle2 className="h-6 w-6 text-green-500" aria-hidden="true" /><p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Nenhum contrato em risco</p><p className="text-[10px] text-slate-500">A base disponível não apresenta contratos abaixo do limite.</p></div> : <div className="space-y-2">{model.riskContracts.map((contract) => <button key={contract.id} type="button" onClick={() => onNavigate(`/kanban?crs=${contract.id}`)} className="flex w-full items-center gap-2 rounded-lg border border-red-100 bg-red-50/70 p-2 text-left transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:bg-red-950/40"><AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{contract.name}</span><span className="shrink-0 text-xs font-bold text-red-600 dark:text-red-300">{contract.progress}%</span></button>)}</div>}
              </div>
              <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Capacidade por responsável</h3><span className="text-[10px] text-slate-500">Top 6 por conclusão</span></div>
                {model.responsibleData.length === 0 ? <p className="py-16 text-center text-xs text-slate-500">Nenhum responsável com tarefas no escopo atual.</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={model.responsibleData} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" width={82} tick={{ fontSize: 9 }} /><Tooltip formatter={(value, name) => [name === "completion" ? `${value}%` : value, name === "completion" ? "Conclusão" : "Atrasos"]} /><Bar dataKey="completion" fill="#7c3aed" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><CircleDot className="h-3 w-3 text-teal-600" aria-hidden="true" /> Valores calculados a partir dos dados reais do escopo atual.</span>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate("/projects")} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-300"><Layers3 className="h-3 w-3" aria-hidden="true" /> Contratos</button><button type="button" onClick={() => onNavigate("/kanban")} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-300"><Users className="h-3 w-3" aria-hidden="true" /> Kanban</button><button type="button" onClick={() => onNavigate("/dashboard#mapa")} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-300"><Target className="h-3 w-3" aria-hidden="true" /> Mapa</button></div>
          </div>
        </>
      )}
    </section>
  );
}
