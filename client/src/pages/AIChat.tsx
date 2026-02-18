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

function exportToPDF(history: any[], projectName?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxW = pageW - margin * 2;
  let y = 20;

  // Header
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, pageW, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Orbita — Relatório de Projeto", margin, 9.5);
  if (projectName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, pageW - margin, 9.5, { align: "right" });
  }

  y = 24;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 10;

  // Messages
  for (const msg of history) {
    const role = (msg as any).role as string;
    const content = (msg as any).content as string;
    const time = new Date((msg as any).createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Role label
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(role === "user" ? 79 : 109, role === "user" ? 70 : 40, role === "user" ? 229 : 217);
    doc.text(role === "user" ? `Usuário  ${time}` : `Orbita IA  ${time}`, margin, y);
    y += 5;

    // Content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);

    // Strip markdown for PDF
    const plain = content
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    const lines = doc.splitTextToSize(plain, maxW);
    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 4;

    // Separator
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
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
    onError: (e) => toast.error(e.message),
  });

  const clearMutation = trpc.chat.clearHistory.useMutation({
    onSuccess: () => {
      utils.chat.history.invalidate({ projectId: selectedProjectId });
      toast.success("Histórico limpo.");
    },
  });

  const reportMutation = trpc.chat.generateReport.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const checkDueDatesMutation = trpc.notifications.checkDueDates.useMutation({
    onSuccess: (data) => {
      if (data.sent > 0) {
        toast.success(`${data.sent} notificação(ões) de vencimento enviada(s).`);
      } else {
        toast.info("Nenhuma tarefa vence nas próximas 24 horas.");
      }
    },
    onError: (e) => toast.error(e.message),
  });

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
      await reportMutation.mutateAsync({ projectId: selectedProjectId });
      utils.chat.history.invalidate({ projectId: selectedProjectId });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportPDF = () => {
    if (!history?.length) return toast.error("Nenhuma conversa para exportar.");
    const project = projects?.find((p) => p.id === selectedProjectId);
    exportToPDF(history, project?.name);
    toast.success("PDF exportado com sucesso!");
  };

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

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
                {projects?.map((p) => (
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
              {history.map((msg) => (
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
