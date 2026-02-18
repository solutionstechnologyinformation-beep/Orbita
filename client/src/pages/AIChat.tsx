import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Trash2, FileBarChart, Loader2, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
              <SelectTrigger className="bg-input border-border">
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
          <div className="flex items-center gap-2">
            {selectedProjectId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-border"
                onClick={handleReport}
                disabled={generatingReport || reportMutation.isPending}
              >
                {generatingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileBarChart className="w-3.5 h-3.5" />}
                Gerar Relatório
              </Button>
            )}
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
              <h3 className="text-lg font-semibold mb-2">Assistente IA de Projetos</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Analise carga de trabalho, obtenha sugestões inteligentes de priorização e gere relatórios automáticos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setMessage(prompt)}
                    className="text-left px-4 py-3 rounded-xl glass border border-border/50 hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-all duration-150"
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
                    (msg as any).role === "user" ? "bg-primary/20" : "bg-violet-500/20"
                  )}>
                    {(msg as any).role === "user"
                      ? <User className="w-4 h-4 text-primary" />
                      : <Bot className="w-4 h-4 text-violet-400" />
                    }
                  </div>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                    (msg as any).role === "user"
                      ? "bg-primary/20 text-foreground rounded-tr-sm"
                      : "bg-card border border-border rounded-tl-sm"
                  )}>
                    {(msg as any).role === "assistant"
                      ? <Streamdown className="prose prose-invert prose-sm max-w-none">{(msg as any).content}</Streamdown>
                      : <p>{(msg as any).content}</p>
                    }
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {new Date((msg as any).createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              {sendMutation.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
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
        <div className="mt-4 glass rounded-2xl p-3 border border-border/50">
          <Textarea
            placeholder="Pergunte sobre seus projetos, tarefas ou peça sugestões..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-transparent border-0 resize-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0 p-1 min-h-[60px]"
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
              className="gap-2 bg-primary hover:bg-primary/90"
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
