import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLocation } from "wouter";
import { Bot, CalendarDays, ChevronRight, FolderKanban, Kanban, Loader2, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FLOATING_AGENT_TRANSITION, getFloatingAgentPlacement } from "./agent-transition";
import {
  createInitialAgentHistory,
  HISTORY_CLEAR_DURATION_MS,
  INITIAL_SCREEN_ENTRY_DURATION_MS,
  type AgentHistoryEntry,
} from "./agent-history";
import { getQuickCommandVisualState } from "./quick-command-state";

type AgentMessage = AgentHistoryEntry;

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

const DEFAULT_PANEL_WIDTH = 400;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 560;

type PanelInteraction =
  | { type: "drag"; startX: number; startY: number; baseLeft: number; baseTop: number; width: number; height: number }
  | { type: "resize"; startX: number; startY: number; originWidth: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FloatingAgent({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [panelOffset, setPanelOffset] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<PanelInteraction | null>(null);
  const clearHistoryTimeoutRef = useRef<number | null>(null);
  const ignoreNextResponseRef = useRef(false);
  const [message, setMessage] = useState("");
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isInitialScreenEntering, setIsInitialScreenEntering] = useState(false);
  const [activeQuickCommand, setActiveQuickCommand] = useState<string | null>(null);
  const [history, setHistory] = useState<AgentMessage[]>(createInitialAgentHistory);

  useEffect(() => {
    return () => {
      if (clearHistoryTimeoutRef.current !== null) {
        window.clearTimeout(clearHistoryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const compactMode = compact && isDesktop;
  const responsiveMinPanelWidth = Math.min(MIN_PANEL_WIDTH, Math.max(260, viewportWidth - 32));
  const maxAvailablePanelWidth = Math.max(responsiveMinPanelWidth, Math.min(MAX_PANEL_WIDTH, viewportWidth - 32));
  const effectivePanelWidth = clamp(panelWidth, responsiveMinPanelWidth, maxAvailablePanelWidth);

  const chatM = trpc.floatingAgent.chat.useMutation({
    onSuccess: (data) => {
      if (ignoreNextResponseRef.current) {
        ignoreNextResponseRef.current = false;
        setActiveQuickCommand(null);
        return;
      }
      setActiveQuickCommand(null);
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
      if (ignoreNextResponseRef.current) {
        ignoreNextResponseRef.current = false;
        setActiveQuickCommand(null);
        return;
      }
      setActiveQuickCommand(null);
      setHistory((items) => [...items, { role: "assistant", content: `Não consegui concluir: ${error.message}` }]);
    },
  });

  const clearHistory = () => {
    if (isClearingHistory) return;
    ignoreNextResponseRef.current = chatM.isPending;
    chatM.reset();
    setActiveQuickCommand(null);
    setMessage("");
    setIsClearingHistory(true);
    toast.success("Histórico da conversa limpo");

    if (clearHistoryTimeoutRef.current !== null) {
      window.clearTimeout(clearHistoryTimeoutRef.current);
    }
    clearHistoryTimeoutRef.current = window.setTimeout(() => {
      setHistory(createInitialAgentHistory());
      setIsClearingHistory(false);
      setIsInitialScreenEntering(true);
      clearHistoryTimeoutRef.current = null;
    }, HISTORY_CLEAR_DURATION_MS);
  };

  const sendMessage = (nextMessage = message) => {
    const trimmed = nextMessage.trim();
    if (!trimmed || chatM.isPending) return;
    setIsInitialScreenEntering(false);
    setHistory((items) => [...items, { role: "user", content: trimmed }]);
    setMessage("");
    chatM.mutate({ message: trimmed });
  };

  useEffect(() => {
    setPanelOffset(null);
  }, [compactMode]);

  useEffect(() => {
    if (!isInitialScreenEntering) return;
    const timeout = window.setTimeout(() => setIsInitialScreenEntering(false), INITIAL_SCREEN_ENTRY_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isInitialScreenEntering]);

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input")) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const currentOffset = panelOffset ?? { x: 0, y: 0 };
    interactionRef.current = {
      type: "drag",
      startX: event.clientX,
      startY: event.clientY,
      baseLeft: rect.left - currentOffset.x,
      baseTop: rect.top - currentOffset.y,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.type !== "drag") return;
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    const minX = 8 - interaction.baseLeft;
    const maxX = window.innerWidth - interaction.width - 8 - interaction.baseLeft;
    const minY = 8 - interaction.baseTop;
    const maxY = window.innerHeight - interaction.height - 8 - interaction.baseTop;
    setPanelOffset({
      x: clamp(deltaX, minX, maxX),
      y: clamp(deltaY, minY, maxY),
    });
  };

  const finishInteraction = (event: PointerEvent<HTMLDivElement>) => {
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const beginResize = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    interactionRef.current = { type: "resize", startX: event.clientX, startY: event.clientY, originWidth: effectivePanelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.type !== "resize") return;
    const nextWidth = clamp(interaction.originWidth + event.clientX - interaction.startX, responsiveMinPanelWidth, maxAvailablePanelWidth);
    setPanelWidth(nextWidth);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPanelWidth((current) => clamp(current + step, responsiveMinPanelWidth, maxAvailablePanelWidth));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPanelWidth((current) => clamp(current - step, responsiveMinPanelWidth, maxAvailablePanelWidth));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPanelWidth(responsiveMinPanelWidth);
    } else if (event.key === "End") {
      event.preventDefault();
      setPanelWidth(maxAvailablePanelWidth);
    }
  };

  const agentPositionStyle = getFloatingAgentPlacement(compactMode, effectivePanelWidth);

  return (
    <div
      className="fixed z-[70] flex flex-col items-end gap-3 transition duration-500 ease-out"
      style={{ ...agentPositionStyle, transitionProperty: FLOATING_AGENT_TRANSITION }}
      data-sidebar-mode={compactMode ? "collapsed" : "expanded"}
    >
      {open && (
        <div
          ref={panelRef}
          className={`${compactMode ? "absolute bottom-full left-[calc(100%+1rem)] z-[80] mb-2" : ""} relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl animate-in fade-in ${compactMode ? "slide-in-from-left-2" : "slide-in-from-bottom-3"} duration-200`}
          style={{
            width: effectivePanelWidth,
            maxWidth: "calc(100vw - 32px)",
            transform: panelOffset ? `translate(${panelOffset.x}px, ${panelOffset.y}px)` : undefined,
            touchAction: "none",
          }}
          onPointerMove={moveDrag}
          onPointerUp={finishInteraction}
          onPointerCancel={finishInteraction}
        >
          <div
            className="flex cursor-grab items-center gap-3 bg-black px-4 py-3 text-white active:cursor-grabbing"
            onPointerDown={beginDrag}
            aria-label="Arrastar painel do Orbita AI"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#ffc30d] text-black">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black" aria-label="Assistente disponível" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Orbita AI</p>
              <p className="text-xs text-white/70">Navegação e consulta inteligente</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={clearHistory}
              disabled={isClearingHistory}
              aria-label="Limpar histórico da conversa"
              title="Limpar histórico"
            >
              <Trash2 className={`h-4 w-4 transition-transform duration-200 ${isClearingHistory ? "rotate-[-20deg]" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fechar assistente">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {(history.length === 1 || activeQuickCommand !== null) && !isClearingHistory && (
            <div
              className={`border-b bg-gradient-to-br from-[#fff9dc] to-white px-4 py-3 ${isInitialScreenEntering ? "animate-in fade-in slide-in-from-bottom-2" : ""}`}
              style={isInitialScreenEntering ? { animationDuration: `${INITIAL_SCREEN_ENTRY_DURATION_MS}ms` } : undefined}
            >
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Sugestões rápidas
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickCommands.map(({ label, prompt, description, icon: Icon }, index) => {
                  const visualState = getQuickCommandVisualState(label, activeQuickCommand, chatM.isPending, isClearingHistory, description);
                  return (
                  <button
                    key={label}
                    type="button"
                    className={`group rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#ffc30d] hover:shadow-sm disabled:cursor-wait disabled:opacity-70 ${isInitialScreenEntering ? "animate-in fade-in slide-in-from-bottom-1" : ""}`}
                    style={isInitialScreenEntering ? { animationDelay: `${(index + 1) * 45}ms`, animationDuration: `${INITIAL_SCREEN_ENTRY_DURATION_MS}ms`, animationFillMode: "both" } : undefined}
                    onClick={() => {
                      setActiveQuickCommand(label);
                      sendMessage(prompt);
                    }}
                    disabled={visualState.isDisabled}
                    aria-busy={visualState.isLoading}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      {visualState.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d99b00]" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-black" />}
                      {visualState.title}
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-slate-500">{visualState.description}</span>
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`max-h-72 space-y-3 overflow-y-auto p-4 transition-opacity duration-200 ease-out ${isClearingHistory ? "opacity-0" : "opacity-100"} ${isInitialScreenEntering ? "animate-in fade-in slide-in-from-bottom-2" : ""}`}
            style={isInitialScreenEntering ? { animationDuration: `${INITIAL_SCREEN_ENTRY_DURATION_MS}ms` } : undefined}
            aria-live="polite"
            aria-busy={isClearingHistory}
          >
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
                disabled={chatM.isPending || isClearingHistory}
                aria-label="Mensagem para o Orbita AI"
              />
              <Button type="button" size="icon" onClick={() => sendMessage()} disabled={!message.trim() || chatM.isPending || isClearingHistory} aria-label="Enviar comando">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div
            className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm border-b-2 border-r-2 border-slate-300 transition-colors hover:border-[#ffc30d] focus-visible:border-[#ffc30d]"
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar painel do Orbita AI"
            aria-valuemin={responsiveMinPanelWidth}
            aria-valuemax={maxAvailablePanelWidth}
            aria-valuenow={effectivePanelWidth}
            tabIndex={0}
            onPointerDown={beginResize}
            onPointerMove={moveResize}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
            onKeyDown={resizeWithKeyboard}
          />
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
