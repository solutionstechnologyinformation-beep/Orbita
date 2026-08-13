import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bot, CalendarDays, ChevronRight, FolderKanban, Kanban, Loader2, Search, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FLOATING_AGENT_TRANSITION, getFloatingAgentPlacement } from "./agent-transition";

type AgentMessage = { role: "user" | "assistant"; content: string };

type QuickCommand = {
  label: string;
  prompt: string;
  description: string;
  icon: typeof Kanban;
};

const quickCommands: QuickCommand[] = [
  { label: "Abrir o Kanban", prompt: "Ir para o Kanban", description: "Ver e organizar tarefas", icon: Kanban },
  { label: "Ver minha agenda", prompt: "Ver minha agenda", description: "Consultar compromissos", icon: CalendarDays },
  { label: "Abrir projetos", prompt: "Abrir os projetos", description: "Acessar contratos e CRS", icon: FolderKanban },
  { label: "Pesquisar tarefas", prompt: "Pesquisar tarefas atrasadas", description: "Encontrar algo específico", icon: Search },
];

export function FloatingAgent({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<AgentMessage[]>([
    { role: "assistant", content: "Olá! Posso te levar até tarefas, pesquisar projetos ou consultar sua agenda." },
  ]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const compactMode = compact && isDesktop;

  const chatM = trpc.floatingAgent.chat.useMutation({
    onSuccess: (data) => {
      setHistory((items) => [...items, { role: "assistant", content: data.reply }]);
      const action = data.action;
      if (action?.type === "navigate" && action.targetUrl) {
        navigate(action.targetUrl);
        setOpen(false);
      } else if (action?.type === "agenda") {
        navigate("/calendar");
      } else if (action?.type === "search" && action.searchTerm) {
        toast.info(`Pesquisa sugerida: ${action.searchTerm}`);
        navigate(`/kanban?search=${encodeURIComponent(action.searchTerm)}`);
      }
    },
    onError: (error) => {
      setHistory((items) => [...items, { role: "assistant", content: `Não consegui concluir: ${error.message}` }]);
    },
  });

  const sendMessage = (nextMessage = message) => {
    const trimmed = nextMessage.trim();
    if (!trimmed || chatM.isPending) return;
    setHistory((items) => [...items, { role: "user", content: trimmed }]);
    setMessage("");
    chatM.mutate({ message: trimmed });
  };

  const agentPositionStyle = getFloatingAgentPlacement(compactMode);

  return (
    <div
      className="fixed z-[70] flex flex-col items-end gap-3 transition duration-500 ease-out"
      style={{ ...agentPositionStyle, transitionProperty: FLOATING_AGENT_TRANSITION }}
      data-sidebar-mode={compactMode ? "collapsed" : "expanded"}
    >
      {open && (
        <div className={`${compactMode ? "absolute bottom-full left-[calc(100%+1rem)] z-[80] mb-2 w-[min(400px,calc(100vw-6rem))]" : "w-[min(400px,calc(100vw-2rem))]"} overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl animate-in fade-in ${compactMode ? "slide-in-from-left-2" : "slide-in-from-bottom-3"} duration-200`}>
          <div className="flex items-center gap-3 bg-black px-4 py-3 text-white">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#ffc30d] text-black">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black" aria-label="Assistente disponível" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Orbita AI</p>
              <p className="text-xs text-white/70">Navegação e consulta inteligente</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fechar assistente">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {history.length === 1 && !chatM.isPending && (
            <div className="border-b bg-gradient-to-br from-[#fff9dc] to-white px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Sugestões rápidas
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickCommands.map(({ label, prompt, description, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className="group rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#ffc30d] hover:shadow-sm"
                    onClick={() => sendMessage(prompt)}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <Icon className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-black" />
                      {label}
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-72 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {history.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${item.role === "user" ? "rounded-br-sm bg-[#ffc30d] text-black" : "rounded-bl-sm bg-slate-100 text-slate-800"}`}>
                  {item.role === "assistant" ? <TypingMessage text={item.content} animate={index === history.length - 1} /> : item.content}
                </div>
              </div>
            ))}
            {chatM.isPending && (
              <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando o Orbita...</div>
            )}
          </div>

          <div className="border-t bg-slate-50 p-3">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
                placeholder="Ex.: ir para a tarefa 12"
                disabled={chatM.isPending}
                aria-label="Mensagem para o Orbita AI"
              />
              <Button type="button" size="icon" onClick={() => sendMessage()} disabled={!message.trim() || chatM.isPending} aria-label="Enviar comando">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${compactMode ? "h-10 w-10" : "h-14 w-14"} group flex items-center justify-center rounded-full bg-black text-[#ffc30d] shadow-xl ring-4 ring-[#ffc30d]/30 transition-[width,height,transform,box-shadow] duration-500 ease-out hover:scale-105 hover:ring-[#ffc30d]/60`}
        aria-label={open ? "Fechar Orbita AI" : "Abrir Orbita AI"}
        title="Abrir Orbita AI"
      >
        {open ? <ChevronRight className="h-5 w-5" /> : <Bot className={`${compactMode ? "h-5 w-5" : "h-6 w-6"} transition group-hover:rotate-6`} />}
      </button>
    </div>
  );
}

function TypingMessage({ text, animate }: { text: string; animate: boolean }) {
  const [visibleText, setVisibleText] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      return;
    }

    let current = 0;
    setVisibleText("");
    const interval = window.setInterval(() => {
      current += 2;
      const nextText = text.slice(0, current);
      setVisibleText(nextText);
      if (current >= text.length) window.clearInterval(interval);
    }, 18);

    return () => window.clearInterval(interval);
  }, [animate, text]);

  const isTyping = animate && visibleText.length < text.length;
  return <span>{visibleText}{isTyping && <span className="ml-0.5 inline-block animate-pulse text-slate-400" aria-hidden="true">▋</span>}</span>;
}
