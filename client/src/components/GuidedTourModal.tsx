import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen, Bot, Building2,
  CalendarDays, CheckCircle2, ClipboardList, FileBarChart, Flag,
  FolderKanban, GanttChartSquare, Kanban, LayoutDashboard, MessageSquare,
  PlayCircle, Presentation, RotateCcw, Shield, Sparkles, X,
} from "lucide-react";

export interface GuidedTourStep {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  href: string;
  icon: typeof LayoutDashboard;
}

export const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  { id: "dashboard", title: "Dashboard executivo", eyebrow: "Visão geral", description: "Acompanhe a saúde dos projetos em uma visão consolidada, com KPIs, OKRs, tendências, sprints, contratos e alertas de execução.", bullets: ["Indicadores por período", "OKRs e tendências", "Atalhos para detalhes"], href: "/dashboard", icon: LayoutDashboard },
  { id: "projects", title: "Projetos e contratos", eyebrow: "Estrutura de trabalho", description: "Organize projetos, empresas, contratos CRS, membros, papéis e informações essenciais para cada frente de trabalho.", bullets: ["Projetos por empresa", "Membros e permissões", "Contratos vinculados"], href: "/projects", icon: FolderKanban },
  { id: "kanban", title: "Kanban de tarefas", eyebrow: "Execução", description: "Visualize o fluxo das tarefas e mova cards entre etapas com regras de aprovação e rastreabilidade das mudanças.", bullets: ["Busca e filtros", "Responsáveis e prazos", "Status e aprovações"], href: "/kanban", icon: Kanban },
  { id: "gantt", title: "Gantt e dependências", eyebrow: "Planejamento temporal", description: "Planeje datas, marcos e dependências em uma linha do tempo visual, identificando conflitos antes que afetem a entrega.", bullets: ["Barras por atividade", "Conflitos de agenda", "Visual mobile"], href: "/gantt", icon: GanttChartSquare },
  { id: "sprints", title: "Sprints e burndown", eyebrow: "Ritmo de entrega", description: "Defina ciclos de trabalho, metas e tarefas prioritárias para acompanhar a evolução de cada sprint.", bullets: ["Metas por ciclo", "Tarefas vinculadas", "Progresso"], href: "/sprints", icon: Flag },
  { id: "scheduling", title: "Programação", eyebrow: "Capacidade da equipe", description: "Visualize a distribuição de atividades por responsável, disciplina e período, incluindo conflitos com a agenda.", bullets: ["Swimlanes", "Filtros de período", "Sobreposições"], href: "/scheduling", icon: BarChart3 },
  { id: "calendar", title: "Calendário", eyebrow: "Agenda operacional", description: "Centralize tarefas com vencimento, reuniões, férias e outros eventos para facilitar a coordenação diária.", bullets: ["Visão mensal", "Vencimentos", "Eventos"], href: "/calendar", icon: CalendarDays },
  { id: "meetings", title: "Reuniões", eyebrow: "Alinhamento", description: "Registre e acompanhe reuniões, participantes, pautas e encaminhamentos conectados aos projetos.", bullets: ["Participantes", "Links de reunião", "Decisões"], href: "/reunioes", icon: ClipboardList },
  { id: "reports", title: "Relatórios", eyebrow: "Prestação de contas", description: "Transforme os dados operacionais em PDFs visuais e planilhas Excel estruturadas para reuniões e auditorias.", bullets: ["PDF institucional", "Excel executivo", "Migração"], href: "/relatorios", icon: FileBarChart },
  { id: "team-chat", title: "Chat de tarefas", eyebrow: "Colaboração", description: "Mantenha a conversa contextualizada dentro das tarefas, com comentários, menções e histórico da execução.", bullets: ["Mensagens por tarefa", "Menções", "Histórico"], href: "/team-chat", icon: MessageSquare },
  { id: "whiteboard", title: "Quadro branco", eyebrow: "Planejamento visual", description: "Estruture ideias, relações e decisões em um espaço visual compartilhado por projeto.", bullets: ["Notas e formas", "Relações", "Estado salvo"], href: "/whiteboard", icon: Presentation },
  { id: "notifications", title: "Notificações", eyebrow: "Acompanhamento", description: "Receba alertas sobre mudanças de status, atribuições, prazos, comentários, convites e eventos importantes.", bullets: ["Alertas por tipo", "Preferências", "Leitura"], href: "/notifications", icon: Bell },
  { id: "ai", title: "Chat IA e Assistente Órbita", eyebrow: "Inteligência aplicada", description: "Consulte informações, resuma relatórios, analise carga de trabalho e peça sugestões para distribuir demandas.", bullets: ["Linguagem natural", "Workload", "Recomendações"], href: "/chat", icon: Bot },
  { id: "admin", title: "Administração e multi-tenant", eyebrow: "Governança", description: "Gerencie usuários, empresas, segurança, branding, domínios personalizados, logs e permissões.", bullets: ["Ambientes isolados", "Branding e domínios", "2FA e auditoria"], href: "/admin", icon: Shield },
  { id: "migration", title: "Migração e backups", eyebrow: "Portabilidade", description: "Exporte snapshots, faça backups e importe dados com confirmação, progresso e log detalhado.", bullets: ["JSON e Excel", "Validação", "Log de processamento"], href: "/migration", icon: RotateCcw },
  { id: "manual", title: "Manual de uso", eyebrow: "Aprendizado contínuo", description: "Consulte orientações sobre o funcionamento do sistema, fluxos recomendados e boas práticas.", bullets: ["Consulta rápida", "Orientação por módulo", "Novos usuários"], href: "/manual", icon: BookOpen },
];

interface GuidedTourModalProps { isOpen: boolean; onClose: () => void; }

export function GuidedTourModal({ isOpen, onClose }: GuidedTourModalProps) {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const step = GUIDED_TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === GUIDED_TOUR_STEPS.length - 1;

  useEffect(() => {
    if (!isOpen) { setCurrentStep(0); return; }
    closeButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    navigate(step.href);
    const target = document.querySelector<HTMLElement>(`[data-tour-nav="${step.href}"]`);
    if (!target) return;
    const previous = { outline: target.style.outline, offset: target.style.outlineOffset, z: target.style.zIndex };
    target.style.outline = "3px solid #f59e0b";
    target.style.outlineOffset = "2px";
    target.style.zIndex = "60";
    return () => { target.style.outline = previous.outline; target.style.outlineOffset = previous.offset; target.style.zIndex = previous.z; };
  }, [isOpen, navigate, step.href]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && !isLast) setCurrentStep((value) => value + 1);
      if (event.key === "ArrowLeft" && !isFirst) setCurrentStep((value) => value - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isFirst, isLast, onClose]);

  if (!isOpen) return null;
  const next = () => isLast ? onClose() : setCurrentStep((value) => value + 1);
  const previous = () => { if (!isFirst) setCurrentStep((value) => value - 1); };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="fixed bottom-4 left-4 right-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:left-auto sm:right-6 sm:w-[min(520px,calc(100vw-3rem))]" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title" aria-describedby="guided-tour-description">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><StepIcon className="h-6 w-6" aria-hidden="true" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">{step.eyebrow}</p><h2 id="guided-tour-title" className="mt-1 text-xl font-bold tracking-tight">{step.title}</h2></div></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Encerrar guia de apresentação" title="Encerrar guia"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5" aria-live="polite"><div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400"><span>Etapa {currentStep + 1} de {GUIDED_TOUR_STEPS.length}</span><span>{Math.round(((currentStep + 1) / GUIDED_TOUR_STEPS.length) * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-200" style={{ width: `${((currentStep + 1) / GUIDED_TOUR_STEPS.length) * 100}%` }} /></div></div>
        <p id="guided-tour-description" className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">{step.bullets.map((bullet) => <div key={bullet} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /><span>{bullet}</span></div>)}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><span className="text-xs text-slate-500 sm:inline">Use ← → ou Esc</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={previous} disabled={isFirst} className="gap-1.5"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Anterior</Button><Button type="button" size="sm" onClick={next} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">{isLast ? "Concluir" : "Próxima aba"}{isLast ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}</Button></div></div>
      </section>
    </div>
  );
}

export function GuidedTourLauncher({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return <button type="button" onClick={onClick} data-tour-launcher="true" className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${compact ? "justify-center" : ""}`} aria-label="Abrir guia de apresentação" title={compact ? "Guia de apresentação" : undefined}><PlayCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{!compact && <span>Guia de apresentação</span>}</button>;
}
