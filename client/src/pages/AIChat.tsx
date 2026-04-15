import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Bot, Send, Trash2, Loader2, User, Sparkles, Download,
  BarChart3, AlertTriangle, Users, TrendingUp, ChevronRight,
  RefreshCw, MessageSquare, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import jsPDF from "jspdf";

// ── Export last AI response as PDF ───────────────────────────────────────────
function exportLastResponseToPDF(history: any[], projectName?: string) {
  const lastAI = [...history].reverse().find((m: any) => m.role === "assistant");
  if (!lastAI) { toast.error("Nenhuma resposta da IA para exportar."); return; }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxW = pageW - margin * 2;

  doc.setFillColor(21, 97, 173);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Orbita", margin, 11.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 225, 255);
  doc.text("— Análise IA", margin + 33, 11.5);
  if (projectName) {
    doc.setTextColor(29, 186, 180);
    doc.text(projectName, pageW - margin, 11.5, { align: "right" });
  }

  let y = 28;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 8;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const plain = (lastAI.content as string)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const lines = doc.splitTextToSize(plain, maxW);
  for (const line of lines) {
    if (y > 278) { doc.addPage(); y = 20; }
    doc.text(line, margin, y);
    y += 5.5;
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(21, 97, 173);
    doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, "F");
    doc.setTextColor(200, 225, 255);
    doc.setFontSize(7);
    doc.text("Orbita — Plataforma de Gestão de Projetos", margin, doc.internal.pageSize.getHeight() - 3.5);
    doc.setTextColor(29, 186, 180);
    doc.text(`Pág. ${pg}/${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 3.5, { align: "right" });
  }
  doc.save(`orbita-analise-${Date.now()}.pdf`);
}

// ── Painel de KPIs rápidos ────────────────────────────────────────────────────
function QuickKPIs({ ctx }: { ctx: any }) {
  if (!ctx?.stats) return null;
  const { stats } = ctx;
  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const kpis = [
    { label: "Contratos Ativos", value: stats.totalCrs, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total de Tarefas", value: stats.totalTasks, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Em Atraso", value: stats.overdueTasks, color: "text-red-600", bg: "bg-red-50" },
    { label: "Taxa de Conclusão", value: `${completionRate}%`, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {kpis.map((k) => (
        <div key={k.label} className={cn("rounded-xl p-3 flex flex-col gap-0.5", k.bg)}>
          <span className={cn("text-xl font-bold", k.color)}>{k.value}</span>
          <span className="text-xs text-muted-foreground">{k.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Prompts analíticos pré-definidos ─────────────────────────────────────────
const ANALYTICAL_PROMPTS = [
  {
    icon: BarChart3,
    label: "Carga de Trabalho",
    prompt: "Analise a carga de trabalho atual da equipe. Quais membros estão sobrecarregados? Quais têm capacidade disponível? Sugira redistribuições.",
    color: "text-blue-600",
    bg: "bg-blue-50 hover:bg-blue-100",
  },
  {
    icon: AlertTriangle,
    label: "Riscos de Atraso",
    prompt: "Quais tarefas têm maior risco de atraso? Identifique padrões e sugira ações preventivas para os próximos 15 dias.",
    color: "text-amber-600",
    bg: "bg-amber-50 hover:bg-amber-100",
  },
  {
    icon: Users,
    label: "Desempenho da Equipe",
    prompt: "Avalie o desempenho individual de cada membro da equipe. Quem está entregando acima da média? Quem precisa de suporte?",
    color: "text-violet-600",
    bg: "bg-violet-50 hover:bg-violet-100",
  },
  {
    icon: TrendingUp,
    label: "Progresso Geral",
    prompt: "Como está o progresso geral dos projetos? Quais contratos estão no prazo e quais estão atrasados? Qual a previsão de conclusão?",
    color: "text-green-600",
    bg: "bg-green-50 hover:bg-green-100",
  },
  {
    icon: FileText,
    label: "Relatório Executivo",
    prompt: "Gere um relatório executivo completo com: situação atual dos projetos, principais riscos, desempenho da equipe e recomendações estratégicas.",
    color: "text-indigo-600",
    bg: "bg-indigo-50 hover:bg-indigo-100",
  },
  {
    icon: MessageSquare,
    label: "Prioridades da Semana",
    prompt: "Com base nos dados atuais, quais são as 5 prioridades mais importantes para esta semana? Justifique cada uma.",
    color: "text-teal-600",
    bg: "bg-teal-50 hover:bg-teal-100",
  },
];

export default function AIChat() {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState("");
  const [selectedCrsId, setSelectedCrsId] = useState<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: projects } = trpc.crs.list.useQuery();

  // Contexto analítico com dados reais
  const { data: contextData, isLoading: loadingContext, refetch: refetchContext } = trpc.aiChat.getContext.useQuery(
    { crsId: selectedCrsId },
    { refetchOnWindowFocus: false }
  );

  const { data: history, isLoading: loadingHistory } = trpc.aiChat.getHistory.useQuery(
    { crsId: selectedCrsId },
    { refetchInterval: false }
  );

  const sendMutation = trpc.aiChat.send.useMutation({
    onSuccess: () => {
      utils.aiChat.getHistory.invalidate({ crsId: selectedCrsId });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearMutation = trpc.aiChat.clearHistory.useMutation({
    onSuccess: () => {
      utils.aiChat.getHistory.invalidate({ crsId: selectedCrsId });
      toast.success("Histórico limpo.");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, sendMutation.isPending]);

  // Invalida histórico ao trocar de projeto
  const handleProjectChange = (v: string) => {
    const newId = v === "general" ? undefined : parseInt(v);
    setSelectedCrsId(newId);
    utils.aiChat.getHistory.invalidate({ crsId: newId });
  };

  const handleSend = async (msg?: string) => {
    const text = msg ?? message;
    if (!text.trim() || sendMutation.isPending) return;
    setMessage("");
    await sendMutation.mutateAsync({
      message: text,
      crsId: selectedCrsId,
      contextData: contextData ?? undefined,
    });
  };

  const handleExportPDF = () => {
    if (!history?.length) return toast.error("Nenhuma conversa para exportar.");
    const project = projects?.find((p: any) => p.id === selectedCrsId);
    exportLastResponseToPDF(history, project?.name);
    toast.success("PDF exportado com sucesso!");
  };

  const selectedProject = useMemo(
    () => projects?.find((p: any) => p.id === selectedCrsId),
    [projects, selectedCrsId]
  );

  const overdueCount = contextData?.stats?.overdueTasks ?? 0;

  return (
    <AppLayout title="Análise IA">
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)] gap-4">

        {/* ── Barra de controles ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Bot className="w-5 h-5 text-primary flex-shrink-0" />
            <Select
              value={selectedCrsId?.toString() ?? "general"}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger className="bg-white border-border">
                <SelectValue placeholder="Todos os contratos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Todos os contratos</SelectItem>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} em atraso
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border bg-white text-muted-foreground"
              onClick={() => refetchContext()}
              disabled={loadingContext}
              title="Atualizar dados do sistema"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loadingContext && "animate-spin")} />
              Atualizar dados
            </Button>
            {(history?.length ?? 0) > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border bg-white text-primary hover:text-primary"
                  onClick={handleExportPDF}
                  title="Exportar última resposta como PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => clearMutation.mutate({ crsId: selectedCrsId })}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── KPIs rápidos ── */}
        {contextData && <QuickKPIs ctx={contextData} />}

        {/* ── Área principal: prompts + chat ── */}
        <div className="flex flex-col flex-1 min-h-0 gap-3">

          {/* Prompts analíticos (visíveis quando não há histórico) */}
          {!loadingHistory && !(history?.length) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Análises rápidas</p>
                {selectedProject && (
                  <Badge variant="outline" className="text-xs">{selectedProject.name}</Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ANALYTICAL_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleSend(p.prompt)}
                    disabled={sendMutation.isPending || loadingContext}
                    className={cn(
                      "text-left px-4 py-3 rounded-xl border border-transparent transition-all duration-150 group",
                      p.bg,
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p.icon className={cn("w-4 h-4 flex-shrink-0", p.color)} />
                      <span className={cn("text-sm font-medium", p.color)}>{p.label}</span>
                      <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.prompt}</p>
                  </button>
                ))}
              </div>

              {/* Indicador de contexto carregado */}
              {contextData && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="py-2 px-4">
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>
                        Contexto carregado: {contextData.stats?.totalTasks ?? 0} tarefas,{" "}
                        {contextData.members?.length ?? 0} membros
                        {selectedProject && `, contrato "${selectedProject.name}"`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Histórico de mensagens */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            {loadingHistory ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {history?.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1",
                      msg.role === "user" ? "bg-primary/10" : "bg-violet-100"
                    )}>
                      {msg.role === "user"
                        ? <User className="w-4 h-4 text-primary" />
                        : <Bot className="w-4 h-4 text-violet-600" />
                      }
                    </div>
                    <div className={cn(
                      "max-w-[82%] rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-white border border-border rounded-tl-sm shadow-sm"
                    )}>
                      {msg.role === "assistant"
                        ? <Streamdown className="prose prose-sm max-w-none text-foreground">{msg.content}</Streamdown>
                        : <p>{msg.content}</p>
                      }
                      <p className={cn(
                        "text-xs mt-2",
                        msg.role === "user" ? "text-white/60" : "text-muted-foreground/60"
                      )}>
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                {sendMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1.5 items-center h-5">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* ── Input de mensagem ── */}
          <div className="bg-white rounded-2xl p-3 border border-border shadow-sm flex-shrink-0">
            {/* Indicador de contexto inline */}
            {contextData && (
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">
                  IA com acesso a dados reais do sistema
                  {selectedProject && ` · ${selectedProject.name}`}
                </span>
              </div>
            )}
            <Textarea
              placeholder="Faça uma pergunta analítica ou escolha uma análise rápida acima..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-transparent border-0 resize-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0 p-1 min-h-[56px] text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">Enter para enviar · Shift+Enter para nova linha</p>
              <Button
                size="sm"
                onClick={() => handleSend()}
                disabled={!message.trim() || sendMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
