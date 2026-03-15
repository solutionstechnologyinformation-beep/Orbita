import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, Trash2, FileBarChart, Loader2, User, Sparkles,
  Download, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";

// ── Draw Orbita logo icon on jsPDF canvas ────────────────────────────────────
function drawOrbitaLogo(doc: any, x: number, y: number, size = 8) {
  // Navy circle background
  doc.setFillColor(30, 45, 90);
  doc.circle(x + size / 2, y + size / 2, size / 2, "F");
  // White "O" ring
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.8);
  doc.circle(x + size / 2, y + size / 2, size / 2 - 1.5, "S");
  // White dot in center
  doc.setFillColor(255, 255, 255);
  doc.circle(x + size / 2, y + size / 2, 1, "F");
  doc.setLineWidth(0.2);
}

// ── Export only the last AI response as a clean PDF ──────────────────────────
function exportLastResponseToPDF(history: any[], projectName?: string) {
  const lastAI = [...history].reverse().find((m: any) => m.role === "assistant");
  if (!lastAI) { toast.error("Nenhuma resposta da IA para exportar."); return; }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxW = pageW - margin * 2;

  // Header bar (brand blue)
  doc.setFillColor(21, 97, 173); // #1561ad
  doc.rect(0, 0, pageW, 20, "F");
  // LS official logo
  try { doc.addImage("https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png", "PNG", margin, 3, 14, 14); } catch(e) {}
  // Orbita name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Orbita", margin + 17, 11.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 225, 255);
  doc.text("— Resultado da Pesquisa", margin + 33, 11.5);
  if (projectName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(29, 186, 180); // #1dbab4 teal
    doc.text(projectName, pageW - margin, 11.5, { align: "right" });
  }

  let y = 28;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 8;

  // Content — strip markdown
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

  // Footer
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(21, 97, 173); // #1561ad
    doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, "F");
    doc.setTextColor(200, 225, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("LS Solutions — Orbita Plataforma de Gestão de Projetos", margin, doc.internal.pageSize.getHeight() - 3.5);
    doc.setTextColor(29, 186, 180); // #1dbab4 teal
    doc.text(`Pág. ${pg}/${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 3.5, { align: "right" });
  }
  doc.save(`orbita-pesquisa-${Date.now()}.pdf`);
}

// ── Generate visual report PDF with charts drawn on Canvas ───────────────────
async function generateVisualReportPDF(chartData: any, reportText: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const maxW = pageW - margin * 2;

  // ── Cover ——
  doc.setFillColor(21, 97, 173); // #1561ad brand blue
  doc.rect(0, 0, pageW, 62, "F");
  // LS official logo
  try { doc.addImage("https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png", "PNG", margin, 11, 14, 14); } catch(e) {}
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ORBITA", margin + 20, 16);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 225, 255);
  doc.text("Plataforma de Gestão de Projetos — LS Solutions", margin + 20, 21);
  // Divider line
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.setGState(new (doc as any).GState({ opacity: 0.25 }));
  doc.line(margin, 26, pageW - margin, 26);
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Executivo", margin, 40);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(chartData.projectName, margin, 52);
  doc.setFontSize(9);
  doc.setTextColor(200, 225, 255);
  doc.text(`Gerado em: ${new Date(chartData.generatedAt).toLocaleString("pt-BR")}`, margin, 60);

  // ── KPI cards ──
  let y = 72;
  doc.setTextColor(30, 30, 30);
  const kpis = [
    { label: "Total de Tarefas", value: String(chartData.counts.total) },
    { label: "Concluídas", value: String(chartData.counts.published + chartData.counts.archived) },
    { label: "Taxa de Conclusão", value: `${chartData.completionRate}%` },
    { label: "Em Atraso", value: String(chartData.overdue) },
    { label: "Membros", value: String(chartData.members) },
  ];
  const cardW = (maxW - 4 * 4) / 5;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardW + 4);
    doc.setFillColor(245, 247, 255);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(21, 97, 173); // #1561ad
    doc.text(kpi.value, x + cardW / 2, y + 11, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(kpi.label, x + cardW / 2, y + 17, { align: "center" });
  });
  y += 30;

  // ── Bar chart: status distribution ──
  const barCanvas = document.createElement("canvas");
  barCanvas.width = 420; barCanvas.height = 170;
  const bCtx = barCanvas.getContext("2d")!;
  bCtx.fillStyle = "#f8f9ff"; bCtx.fillRect(0, 0, 420, 170);
  const statusData = [
    { label: "Para Iniciar", value: chartData.counts.pending, color: "#6366f1" },
    { label: "Em Andamento", value: chartData.counts.in_progress, color: "#3b82f6" },
    { label: "Compartilhado", value: chartData.counts.shared, color: "#f59e0b" },
    { label: "Publicado", value: chartData.counts.published, color: "#10b981" },
    { label: "Arquivado", value: chartData.counts.archived, color: "#6b7280" },
  ];
  const maxVal = Math.max(...statusData.map(d => d.value), 1);
  const barW = 52; const gap = 14; const startX = 28; const chartH = 100; const baseY = 130;
  bCtx.font = "bold 11px Arial"; bCtx.textAlign = "center";
  statusData.forEach((d, i) => {
    const x = startX + i * (barW + gap);
    const h = (d.value / maxVal) * chartH;
    bCtx.fillStyle = d.color;
    bCtx.fillRect(x, baseY - h, barW, h);
    bCtx.fillStyle = "#333";
    bCtx.fillText(String(d.value), x + barW / 2, baseY - h - 5);
    bCtx.fillStyle = "#555"; bCtx.font = "9px Arial";
    const words = d.label.split(" ");
    words.forEach((w, wi) => bCtx.fillText(w, x + barW / 2, baseY + 13 + wi * 11));
    bCtx.font = "bold 11px Arial";
  });
  bCtx.strokeStyle = "#ccc"; bCtx.lineWidth = 1;
  bCtx.beginPath(); bCtx.moveTo(18, baseY); bCtx.lineTo(400, baseY); bCtx.stroke();

  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
  doc.text("Distribuição por Status", margin, y); y += 4;
  const barImgData = barCanvas.toDataURL("image/png");
  const barRenderW = maxW * 0.62;
  const barRenderH = barRenderW * (170 / 420);
  doc.addImage(barImgData, "PNG", margin, y, barRenderW, barRenderH);

  // ── Pie chart: priority ──
  const pieCanvas = document.createElement("canvas");
  pieCanvas.width = 180; pieCanvas.height = 180;
  const pCtx = pieCanvas.getContext("2d")!;
  pCtx.fillStyle = "#f8f9ff"; pCtx.fillRect(0, 0, 180, 180);
  const priorityData = [
    { label: "Urgente", value: chartData.byPriority.urgent, color: "#ef4444" },
    { label: "Alta", value: chartData.byPriority.high, color: "#f97316" },
    { label: "Média", value: chartData.byPriority.medium, color: "#f59e0b" },
    { label: "Baixa", value: chartData.byPriority.low, color: "#6366f1" },
  ];
  const total = priorityData.reduce((s, d) => s + d.value, 0) || 1;
  let angle = -Math.PI / 2;
  priorityData.forEach(d => {
    const slice = (d.value / total) * 2 * Math.PI;
    pCtx.beginPath(); pCtx.moveTo(90, 90);
    pCtx.arc(90, 90, 70, angle, angle + slice);
    pCtx.closePath(); pCtx.fillStyle = d.color; pCtx.fill();
    angle += slice;
  });
  // white center
  pCtx.beginPath(); pCtx.arc(90, 90, 35, 0, 2 * Math.PI); pCtx.fillStyle = "#f8f9ff"; pCtx.fill();

  const pieX = margin + barRenderW + 6;
  const pieRenderW = maxW - barRenderW - 6;
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
  doc.text("Por Prioridade", pieX, y);
  const pieImgData = pieCanvas.toDataURL("image/png");
  doc.addImage(pieImgData, "PNG", pieX, y + 4, pieRenderW, pieRenderW);
  // legend
  let legY = y + 4 + pieRenderW + 4;
  priorityData.forEach(d => {
    doc.setFillColor(parseInt(d.color.slice(1, 3), 16), parseInt(d.color.slice(3, 5), 16), parseInt(d.color.slice(5, 7), 16));
    doc.rect(pieX, legY - 2.5, 4, 4, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(`${d.label}: ${d.value}`, pieX + 6, legY + 0.5);
    legY += 6;
  });

  y += barRenderH + 10;

  // ── Analysis text ──
  doc.addPage();
  y = 20;
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Análise Detalhada — " + chartData.projectName, margin, 9.5);
  y = 22;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
  const plain = reportText
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

  // Footer on all pages
  const totalPgs = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPgs; pg++) {
    doc.setPage(pg);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(21, 97, 173); // #1561ad
    doc.rect(0, pageH - 10, pageW, 10, "F");
    // LS official logo in footer
    try { doc.addImage("https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png", "PNG", margin, pageH - 9, 7, 7); } catch(e) {}
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("by LS Solutions", margin + 9, pageH - 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 225, 255);
    doc.text(`Pág. ${pg}/${totalPgs}`, pageW - margin, pageH - 3.5, { align: "right" });
  }
  doc.save(`orbita-relatorio-${Date.now()}.pdf`);
}

export default function AIChat() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = projectIdParam ? parseInt(projectIdParam) : undefined;

  const utils = trpc.useUtils();
  const [message, setMessage] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(projectId);
  const [generatingReport, setGeneratingReport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: projects } = trpc.projects.list.useQuery();
  const { data: history, isLoading } = trpc.chat.history.useQuery(
    { projectId: selectedProjectId },
    { refetchInterval: false }
  );

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      utils.chat.history.invalidate({ projectId: selectedProjectId });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearMutation = trpc.chat.clearHistory.useMutation({
    onSuccess: () => {
      utils.chat.history.invalidate({ projectId: selectedProjectId });
      toast.success("Histórico limpo.");
    },
  });

  const reportMutation = trpc.aiChat.generateReport.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  // checkDueDates removed - not available in current backend
  const checkDueDatesMutation = { mutate: () => toast.info("Verificação de vencimentos não disponível."), isPending: false };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, sendMutation.isPending]);

  const handleSend = async () => {
    if (!message.trim() || sendMutation.isPending) return;
    const msg = message;
    setMessage("");
    await sendMutation.mutateAsync({ message: msg, projectId: selectedProjectId });
  };

  const handleReport = async () => {
    if (!selectedProjectId) return toast.error("Selecione um projeto para gerar o relatório.");
    setGeneratingReport(true);
    try {
      const result = await reportMutation.mutateAsync({ projectId: selectedProjectId });
      utils.chat.history.invalidate({ projectId: selectedProjectId });
      // Generate visual PDF immediately
      if (result.chartData) {
        await generateVisualReportPDF(result.chartData, result.report);
        toast.success("Relatório visual gerado e baixado!");
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportPDF = () => {
    if (!history?.length) return toast.error("Nenhuma conversa para exportar.");
    const project = projects?.find((p: any) => p.id === selectedProjectId);
    exportLastResponseToPDF(history, project?.name);
    toast.success("PDF exportado com sucesso!");
  };

  const selectedProject = projects?.find((p: any) => p.id === selectedProjectId);
  void selectedProject;

  const suggestedPrompts = [
    "Analise a carga de trabalho atual da equipe",
    "Quais tarefas têm maior risco de atraso?",
    "Sugira prioridades para as tarefas pendentes",
    "Como está o progresso geral do projeto?",
  ];

  return (
    <AppLayout title="Chat com IA">
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        {/* Header Controls */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Bot className="w-5 h-5 text-primary flex-shrink-0" />
            <Select
              value={selectedProjectId?.toString() ?? "general"}
              onValueChange={(v) => setSelectedProjectId(v === "general" ? undefined : parseInt(v))}
            >
              <SelectTrigger className="bg-white border-border">
                <SelectValue placeholder="Contexto geral" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Contexto geral</SelectItem>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedProjectId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-border bg-white"
                onClick={handleReport}
                disabled={generatingReport || reportMutation.isPending}
              >
                {generatingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileBarChart className="w-3.5 h-3.5" />}
                Gerar Relatório
              </Button>
            )}
            {(history?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-border bg-white text-primary hover:text-primary"
                onClick={handleExportPDF}
                title="Exporta somente a última resposta da IA como PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar PDF
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border bg-white text-muted-foreground hover:text-foreground"
              onClick={() => checkDueDatesMutation.mutate()}
              disabled={checkDueDatesMutation.isPending}
              title="Verificar tarefas que vencem em 24h e enviar notificações"
            >
              {checkDueDatesMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Bell className="w-3.5 h-3.5" />
              }
              Alertas de Prazo
            </Button>
            {(history?.length ?? 0) > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-destructive"
                onClick={() => clearMutation.mutate({ projectId: selectedProjectId })}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : !history?.length ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Assistente IA de Projetos</h3>
              <p className="text-muted-foreground mb-8 max-w-md text-sm">
                Analise carga de trabalho, obtenha sugestões inteligentes de priorização e gere relatórios automáticos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setMessage(prompt)}
                    className="text-left px-4 py-3 rounded-xl bg-white border border-border hover:border-primary/40 hover:shadow-sm text-sm text-muted-foreground hover:text-foreground transition-all duration-150"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {history.map((msg: any) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    (msg as any).role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1",
                    (msg as any).role === "user" ? "bg-primary/10" : "bg-violet-100"
                  )}>
                    {(msg as any).role === "user"
                      ? <User className="w-4 h-4 text-primary" />
                      : <Bot className="w-4 h-4 text-violet-600" />
                    }
                  </div>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                    (msg as any).role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-white border border-border rounded-tl-sm shadow-sm"
                  )}>
                    {(msg as any).role === "assistant"
                      ? <Streamdown className="prose prose-sm max-w-none text-foreground">{(msg as any).content}</Streamdown>
                      : <p>{(msg as any).content}</p>
                    }
                    <p className={cn(
                      "text-xs mt-2",
                      (msg as any).role === "user" ? "text-white/60" : "text-muted-foreground/60"
                    )}>
                      {new Date((msg as any).createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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

        {/* Input */}
        <div className="mt-4 bg-white rounded-2xl p-3 border border-border shadow-sm">
          <Textarea
            placeholder="Pergunte sobre seus projetos, tarefas ou peça sugestões..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-transparent border-0 resize-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0 p-1 min-h-[60px] text-foreground placeholder:text-muted-foreground"
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
              onClick={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
