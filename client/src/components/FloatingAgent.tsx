import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bot, CalendarDays, ChevronRight, FolderKanban, Kanban, Loader2, Mic, MicOff, Pause, Play, Radio, Search, Send, Sparkles, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FLOATING_AGENT_TRANSITION, getFloatingAgentPlacement } from "./agent-transition";
import {
  createInitialAgentHistory,
  HISTORY_CLEAR_DURATION_MS,
  INITIAL_SCREEN_ENTRY_DURATION_MS,
  type AgentHistoryEntry,
} from "./agent-history";
import { getQuickCommandVisualState, QUICK_COMMAND_HOVER_CLASSES } from "./quick-command-state";
import { containsWakePhrase, extractFinalTranscript, extractLatestTranscript, getCommandAfterWakePhrase, getSpeechRecognitionConstructor, getVoiceErrorState, getVoiceStatusMessage, type SpeechRecognitionLike, type VoiceRecognitionState } from "./voice-recognition";
import { getAgentActionAnnouncement, getBestPortugueseVoice, getPreferredUserName, getSpeechPlaybackMessage, getSpeechSynthesis, personalizeAssistantReply, shouldSpeakClosingGreeting, stripTextForSpeech, type SpeechPlaybackState, type SpeechSynthesisLike, type SpeechSynthesisUtteranceLike } from "./speech-synthesis";
import { SoundWaveIndicator, type SoundWaveState } from "./SoundWaveIndicator";
import { WorkloadAnalysisLoading } from "./WorkloadAnalysisLoading";
import { isWorkloadAnalysisRequest } from "./workload-analysis-state";
import { buildWorkloadCsv, buildWorkloadPdfHtml, type WorkloadRecommendation } from "./workload-export";

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
const WAKE_GREETING = "Que bom te ver novamente.";
const ASSISTANT_CHARACTER_ASSET = "/manus-storage/orbita-assistant-character-transparent-v2_23718c10.png";
const WAKE_RESTART_DELAY_MS = 4500;
const WAKE_STORAGE_KEY = "orbita-wake-phrase-enabled";

type PanelInteraction =
  | { type: "drag"; startX: number; startY: number; baseLeft: number; baseTop: number; width: number; height: number }
  | { type: "resize"; startX: number; startY: number; originWidth: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FloatingAgent({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const userName = getPreferredUserName(user?.name);
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
  const [voiceState, setVoiceState] = useState<VoiceRecognitionState>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [speechState, setSpeechState] = useState<SpeechPlaybackState>("idle");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const speechRef = useRef<{ synthesis: SpeechSynthesisLike; utterance: SpeechSynthesisUtteranceLike } | null>(null);
  const [wakePhraseEnabled, setWakePhraseEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(WAKE_STORAGE_KEY) === "true";
  });
  const [wakePhraseState, setWakePhraseState] = useState<VoiceRecognitionState>("idle");
  const [wakePhraseMessage, setWakePhraseMessage] = useState("");
  const [latestRecommendations, setLatestRecommendations] = useState<WorkloadRecommendation[]>([]);
  const [isWorkloadPreviewOpen, setIsWorkloadPreviewOpen] = useState(false);
  const [isWorkloadAnalysisPending, setIsWorkloadAnalysisPending] = useState(false);
  const wakeRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRestartTimeoutRef = useRef<number | null>(null);
  const wakePermissionDeniedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (clearHistoryTimeoutRef.current !== null) {
        window.clearTimeout(clearHistoryTimeoutRef.current);
      }
      recognitionRef.current?.abort();
      wakeRecognitionRef.current?.abort();
      if (wakeRestartTimeoutRef.current !== null) window.clearTimeout(wakeRestartTimeoutRef.current);
      speechRef.current?.synthesis.cancel();
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
        setIsWorkloadAnalysisPending(false);
        return;
      }
      setActiveQuickCommand(null);
      setIsWorkloadAnalysisPending(false);
      const action = data.action as any;
      if (action?.recommendations && Array.isArray(action.recommendations)) {
        setLatestRecommendations(action.recommendations);
      }
      const actionAnnouncement = getAgentActionAnnouncement(action, userName);
      const personalizedReply = personalizeAssistantReply(data.reply, userName);
      const fullReply = `${actionAnnouncement}\n\n${personalizedReply}`;
      setHistory((items) => [...items, { role: "assistant", content: fullReply }]);
      
      // Falar somente confirmações curtas de ações ou saudações, sem ler o chat detalhado
      const shortSpeechText = action?.type && action.type !== "none" 
        ? actionAnnouncement 
        : (/^(oi|olá|ola|bom dia|boa tarde|boa noite)\b/i.test(data.reply) ? data.reply.split(".")[0] : "");
      if (shortSpeechText) {
        speakReply(shortSpeechText);
      }
      const routeActionTypes = new Set(["navigate", "map_focus", "map_filter_state", "map_highlight_contract", "generate_report_pdf", "map_export_csv", "map_toggle_layer", "analyze_workload"]);
      if (action?.targetUrl && routeActionTypes.has(action.type)) {
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
        setIsWorkloadAnalysisPending(false);
        return;
      }
      setActiveQuickCommand(null);
      setIsWorkloadAnalysisPending(false);
      const errorReply = personalizeAssistantReply(`Não consegui concluir: ${error.message}`, userName);
      setHistory((items) => [...items, { role: "assistant", content: errorReply }]);
      speakReply(errorReply);
    },
  });

  const stopSpeaking = () => {
    speechRef.current?.synthesis.cancel();
    speechRef.current = null;
    setSpeechState("idle");
  };

  const speakReply = (reply: string) => {
    if (!speechEnabled) return;
    const speech = getSpeechSynthesis();
    const text = stripTextForSpeech(reply);
    if (!speech || !text) {
      setSpeechState(speech ? "idle" : "unsupported");
      return;
    }

    speech.synthesis.cancel();
    const utterance = new speech.Utterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.98;
    utterance.pitch = 0.94;
    const bestVoice = getBestPortugueseVoice(speech.synthesis);
    if (bestVoice) {
      (utterance as any).voice = bestVoice;
    }
    utterance.onstart = () => setSpeechState("speaking");
    utterance.onpause = () => setSpeechState("paused");
    utterance.onresume = () => setSpeechState("speaking");
    utterance.onend = () => {
      speechRef.current = null;
      setSpeechState("idle");
    };
    utterance.onerror = () => {
      speechRef.current = null;
      setSpeechState("error");
    };
    speechRef.current = { synthesis: speech.synthesis, utterance };
    try {
      speech.synthesis.speak(utterance);
    } catch {
      speechRef.current = null;
      setSpeechState("error");
    }
  };

  const toggleSpeechPlayback = () => {
    if (speechState === "speaking") {
      speechRef.current?.synthesis.pause();
      setSpeechState("paused");
    } else if (speechState === "paused") {
      speechRef.current?.synthesis.resume();
      setSpeechState("speaking");
    }
  };

  const toggleSpeechEnabled = () => {
    setSpeechEnabled((enabled) => {
      if (enabled) stopSpeaking();
      return !enabled;
    });
  };

  const clearHistory = () => {
    if (isClearingHistory) return;
    stopSpeaking();
    ignoreNextResponseRef.current = chatM.isPending;
    chatM.reset();
    setActiveQuickCommand(null);
    setMessage("");
    setIsClearingHistory(true);
    setIsWorkloadAnalysisPending(false);
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
    setIsWorkloadAnalysisPending(isWorkloadAnalysisRequest(trimmed));
    setHistory((items) => [...items, { role: "user", content: trimmed }]);
    setMessage("");
    chatM.mutate({ message: trimmed });
  };

  const stopWakePhraseListener = () => {
    wakeRecognitionRef.current?.abort();
    wakeRecognitionRef.current = null;
    if (wakeRestartTimeoutRef.current !== null) {
      window.clearTimeout(wakeRestartTimeoutRef.current);
      wakeRestartTimeoutRef.current = null;
    }
    setWakePhraseState("idle");
  };

  const startWakePhraseListener = () => {
    if (!wakePhraseEnabled || wakeRecognitionRef.current) return;
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setWakePhraseState("unsupported");
      setWakePhraseMessage("A ativação por voz não está disponível neste navegador.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      wakePermissionDeniedRef.current = false;
      setWakePhraseState("listening");
      setWakePhraseMessage("Escuta ativa somente para a frase “Olá Órbita”.");
    };
    recognition.onresult = (event) => {
      const transcript = extractLatestTranscript(event);
      if (!containsWakePhrase(transcript)) return;

      const command = getCommandAfterWakePhrase(transcript);
      recognition.stop();
      setOpen(true);
      setWakePhraseMessage(command ? "Frase de ativação reconhecida. Vou executar seu comando." : "Olá Órbita reconhecido. Estou pronto para ajudar.");
      if (command) {
        window.setTimeout(() => sendMessage(command), 120);
      } else {
        window.setTimeout(() => speakReply(`${userName}, ${WAKE_GREETING}`), 120);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      const nextState = getVoiceErrorState(event.error);
      wakePermissionDeniedRef.current = nextState === "permission-denied";
      setWakePhraseState(nextState);
      setWakePhraseMessage(getVoiceStatusMessage(nextState));
    };
    recognition.onend = () => {
      wakeRecognitionRef.current = null;
      const shouldRestart = window.localStorage.getItem(WAKE_STORAGE_KEY) === "true";
      if (shouldRestart && !wakePermissionDeniedRef.current) {
        wakeRestartTimeoutRef.current = window.setTimeout(() => {
          wakeRestartTimeoutRef.current = null;
          startWakePhraseListener();
        }, WAKE_RESTART_DELAY_MS);
      }
    };

    wakeRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      wakeRecognitionRef.current = null;
      setWakePhraseState("error");
      setWakePhraseMessage(getVoiceStatusMessage("error"));
    }
  };

  const toggleWakePhrase = () => {
    setWakePhraseEnabled((enabled) => {
      const nextEnabled = !enabled;
      window.localStorage.setItem(WAKE_STORAGE_KEY, String(nextEnabled));
      if (!nextEnabled) {
        stopWakePhraseListener();
        setWakePhraseMessage("Ativação por voz desativada.");
      } else {
        setWakePhraseMessage("Solicitando permissão do microfone para ouvir “Olá Órbita”.");
      }
      return nextEnabled;
    });
  };

  const speakClosingGreeting = () => {
    window.setTimeout(() => speakReply(`${userName}, ${WAKE_GREETING}`), 100);
  };

  const toggleAssistantOpen = () => {
    setOpen((value) => {
      const nextOpen = !value;
      if (shouldSpeakClosingGreeting(value, nextOpen)) {
        speakClosingGreeting();
      }
      return nextOpen;
    });
  };

  useEffect(() => {
    if (!wakePhraseEnabled) {
      stopWakePhraseListener();
      return;
    }
    startWakePhraseListener();
    return stopWakePhraseListener;
  }, [wakePhraseEnabled]);

  const toggleVoiceInput = () => {
    if (chatM.isPending || isClearingHistory) return;

    if (voiceState === "listening") {
      recognitionRef.current?.stop();
      setVoiceState("idle");
      setVoiceMessage("");
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setVoiceState("unsupported");
      setVoiceMessage(getVoiceStatusMessage("unsupported"));
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceState("listening");
      setVoiceMessage(getVoiceStatusMessage("listening"));
    };
    recognition.onresult = (event) => {
      const transcript = extractFinalTranscript(event);
      if (!transcript) {
        setVoiceState("error");
        setVoiceMessage(getVoiceStatusMessage("error"));
        return;
      }
      setMessage(transcript);
      setVoiceState("idle");
      setVoiceMessage(`Comando reconhecido: ${transcript}`);
      sendMessage(transcript);
    };
    recognition.onerror = (event) => {
      const nextState = getVoiceErrorState(event.error);
      setVoiceState(nextState);
      setVoiceMessage(getVoiceStatusMessage(nextState));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceState((current) => current === "listening" ? "idle" : current);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceState("error");
      setVoiceMessage(getVoiceStatusMessage("error"));
    }
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

  const exportRecommendationsCsv = () => {
    const csvContent = `data:text/csv;charset=utf-8,${encodeURIComponent(buildWorkloadCsv(latestRecommendations))}`;
    const link = document.createElement("a");
    link.href = csvContent;
    link.download = `distribuicao_equipe_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Planilha CSV exportada com sucesso!");
  };

  const confirmWorkloadPdfExport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permita pop-ups para gerar o PDF.");
      return;
    }
    printWindow.document.write(buildWorkloadPdfHtml(latestRecommendations));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 100);
    setIsWorkloadPreviewOpen(false);
    toast.success("Relatório PDF preparado para impressão ou salvamento.");
  };

  const activeSoundState: SoundWaveState = voiceState === "listening" || wakePhraseState === "listening"
    ? "listening"
    : speechState === "speaking"
      ? "speaking"
      : speechState === "paused"
        ? "paused"
        : voiceState === "error" || wakePhraseState === "error"
          ? "error"
          : "idle";

  const agentPositionStyle = getFloatingAgentPlacement(compactMode, effectivePanelWidth);

  return (
    <div
      className="fixed z-[70] flex flex-row-reverse items-end gap-3 transition duration-500 ease-out max-sm:flex-col"
      style={{ ...agentPositionStyle, transitionProperty: FLOATING_AGENT_TRANSITION }}
      data-sidebar-mode={compactMode ? "collapsed" : "expanded"}
    >
      {open && (
        <div
          ref={panelRef}
          className="relative rounded-3xl rounded-br-md border border-black/10 bg-white shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200 max-sm:slide-in-from-bottom-3"
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
            <div className="relative flex h-11 w-9 shrink-0 items-end justify-center">
              <img src={ASSISTANT_CHARACTER_ASSET} alt="" aria-hidden="true" className="h-11 w-9 object-contain object-bottom" />
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black" aria-label="Assistente disponível" />
              {activeSoundState !== "idle" && <SoundWaveIndicator state={activeSoundState} compact className="absolute -bottom-1 -right-2 bg-black/80 px-1" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Assistente Orbita</p>
              <p className="text-xs text-white/70">Navegação e consulta inteligente</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={wakePhraseEnabled ? "text-[#ffc30d] hover:bg-white/10" : "text-white hover:bg-white/10"}
              onClick={toggleWakePhrase}
              aria-label={wakePhraseEnabled ? "Desativar ativação por Olá Órbita" : "Ativar ativação por Olá Órbita"}
              aria-pressed={wakePhraseEnabled}
              title={wakePhraseEnabled ? "Desativar escuta de Olá Órbita" : "Ativar escuta de Olá Órbita"}
            >
              <Radio className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={toggleSpeechEnabled}
              aria-label={speechEnabled ? "Desativar resposta falada" : "Ativar resposta falada"}
              aria-pressed={speechEnabled}
              title={speechEnabled ? "Desativar resposta falada" : "Ativar resposta falada"}
            >
              {speechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
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
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => { setOpen(false); speakClosingGreeting(); }} aria-label="Fechar assistente">
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
                    className={`group rounded-xl border border-slate-200 bg-white px-3 py-2 text-left ${QUICK_COMMAND_HOVER_CLASSES} disabled:cursor-wait disabled:opacity-70 ${isInitialScreenEntering ? "animate-in fade-in slide-in-from-bottom-1" : ""}`}
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
            {isWorkloadAnalysisPending && chatM.isPending ? (
              <WorkloadAnalysisLoading />
            ) : chatM.isPending ? (
              <div className="flex items-center gap-2 text-xs text-slate-500" role="status" aria-live="polite"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando o Orbita...</div>
            ) : null}
            {latestRecommendations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                  onClick={exportRecommendationsCsv}
                >
                  Exportar Planilha (CSV)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100"
                  onClick={() => setIsWorkloadPreviewOpen(true)}
                >
                  Pré-visualizar e Exportar PDF
                </Button>
              </div>
            )}
          </div>

          <div className="border-t bg-slate-50 p-3">
            {wakePhraseEnabled && (
              <p className="mb-2 flex items-center gap-2 text-[11px] text-slate-600" role="status" aria-live="polite">
                <Radio className={`h-3.5 w-3.5 ${wakePhraseState === "listening" ? "text-emerald-500" : "text-slate-500"}`} aria-hidden="true" />
                {wakePhraseMessage || "Ativação por voz pronta para “Olá Órbita”."}
              </p>
            )}
            {(speechState !== "idle" || !speechEnabled) && (
              <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600" role="status" aria-live="polite">
                <span className="min-w-0 flex-1">{speechEnabled ? getSpeechPlaybackMessage(speechState) : "Resposta falada desativada."}</span>
                {speechEnabled && (speechState === "speaking" || speechState === "paused") && (
                  <>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={toggleSpeechPlayback} aria-label={speechState === "speaking" ? "Pausar leitura" : "Retomar leitura"}>
                      {speechState === "speaking" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={stopSpeaking} aria-label="Parar leitura">
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )}
            {voiceState !== "idle" && (
              <p className="mb-2 flex items-center gap-2 text-[11px] text-slate-600" role="status" aria-live="polite">
                {voiceState === "listening" ? <Mic className="h-3.5 w-3.5 text-red-500" aria-hidden="true" /> : <MicOff className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />}
                {voiceMessage || getVoiceStatusMessage(voiceState)}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
                placeholder="Ex.: ir para a tarefa 12"
                disabled={chatM.isPending || isClearingHistory}
                aria-label="Mensagem para o Orbita AI"
              />
              <Button
                type="button"
                size="icon"
                variant={voiceState === "listening" ? "default" : "outline"}
                onClick={toggleVoiceInput}
                disabled={chatM.isPending || isClearingHistory}
                aria-label={voiceState === "listening" ? "Parar reconhecimento de voz" : "Falar comando por voz"}
                aria-pressed={voiceState === "listening"}
                title={voiceState === "listening" ? "Parar escuta" : "Comando por voz"}
                className={voiceState === "listening" ? "bg-red-500 text-white hover:bg-red-600" : ""}
              >
                {voiceState === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button type="button" size="icon" onClick={() => sendMessage()} disabled={!message.trim() || chatM.isPending || isClearingHistory} aria-label="Enviar comando">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute -right-2 bottom-5 h-4 w-4 rotate-45 border-r border-b border-black/10 bg-white max-sm:-bottom-2 max-sm:right-10" />
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

      <Dialog open={isWorkloadPreviewOpen} onOpenChange={setIsWorkloadPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>Prévia do relatório de distribuição</DialogTitle>
            <DialogDescription>
              Revise as recomendações da análise de demandas antes de confirmar a exportação em PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2">ID</th>
                  <th className="border-b border-slate-200 px-3 py-2">Tarefa</th>
                  <th className="border-b border-slate-200 px-3 py-2">Responsável sugerido</th>
                  <th className="border-b border-slate-200 px-3 py-2">Prazo</th>
                  <th className="border-b border-slate-200 px-3 py-2">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {latestRecommendations.map((recommendation) => (
                  <tr key={recommendation.taskId} className="even:bg-slate-50 align-top">
                    <td className="border-b border-slate-100 px-3 py-3 font-medium">#{recommendation.taskId}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{recommendation.taskTitle}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{recommendation.suggestedAssignee}</td>
                    <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{recommendation.suggestedDueDate}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{recommendation.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsWorkloadPreviewOpen(false)}>
              Voltar
            </Button>
            <Button type="button" onClick={confirmWorkloadPdfExport}>
              Confirmar e exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={toggleAssistantOpen}
        className={`${compactMode ? "h-20 w-14" : "h-28 w-20"} group relative flex shrink-0 items-end justify-center bg-transparent p-0 transition-transform duration-300 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc30d] focus-visible:ring-offset-2`}
        aria-label={open ? "Fechar Assistente Orbita" : "Abrir Assistente Orbita"}
        title={activeSoundState === "listening" ? "Assistente Orbita está ouvindo" : activeSoundState === "speaking" ? "Assistente Orbita está falando" : "Abrir Assistente Orbita"}
      >
        <img src={ASSISTANT_CHARACTER_ASSET} alt="" aria-hidden="true" className="h-full w-full object-contain object-bottom drop-shadow-[0_8px_6px_rgba(0,0,0,0.22)]" />
        <span className="absolute bottom-3 right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" aria-label="Assistente Orbita disponível" />
        {activeSoundState !== "idle" && <SoundWaveIndicator state={activeSoundState} compact className="absolute bottom-7 -right-2 bg-black/80 px-1" />}
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
