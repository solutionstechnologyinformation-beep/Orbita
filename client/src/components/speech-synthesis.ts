export type SpeechPlaybackState = "idle" | "speaking" | "paused" | "unsupported" | "error";

export type SpeechSynthesisUtteranceLike = {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onpause: (() => void) | null;
  onresume: (() => void) | null;
  onerror: (() => void) | null;
};

export type SpeechSynthesisLike = {
  speak: (utterance: SpeechSynthesisUtteranceLike) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  getVoices?: () => any[];
};

type SpeechUtteranceConstructor = new (text: string) => SpeechSynthesisUtteranceLike;

type SpeechWindow = Window & {
  speechSynthesis?: SpeechSynthesisLike;
  SpeechSynthesisUtterance?: SpeechUtteranceConstructor;
};

export function getSpeechSynthesis(windowObject: Window | undefined = typeof window === "undefined" ? undefined : window): {
  synthesis: SpeechSynthesisLike;
  Utterance: SpeechUtteranceConstructor;
} | null {
  if (!windowObject) return null;
  const speechWindow = windowObject as SpeechWindow;
  if (!speechWindow.speechSynthesis || !speechWindow.SpeechSynthesisUtterance) return null;
  return { synthesis: speechWindow.speechSynthesis, Utterance: speechWindow.SpeechSynthesisUtterance };
}

export function stripTextForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_#>]/g, "")
    .replace(/[📊📌✅⚠️🔴🟡🟢⚡]/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

export function getBestPortugueseVoice(synthesis: SpeechSynthesisLike): any | null {
  if (!synthesis || typeof synthesis.getVoices !== "function") return null;
  try {
    const voices = synthesis.getVoices() || [];
    const ptVoices = voices.filter((v: any) => v && v.lang && typeof v.lang === "string" && v.lang.toLowerCase().includes("pt"));
    if (ptVoices.length === 0) return null;
    const naturalPt = ptVoices.find((v: any) => v.name && /natural|enhanced|google|microsoft|online/i.test(v.name));
    const brVoice = ptVoices.find((v: any) => v.lang.toLowerCase().includes("br") || v.lang.toLowerCase().includes("pt"));
    return naturalPt || brVoice || ptVoices[0];
  } catch {
    return null;
  }
}

export type AgentActionLike = {
  type?: string;
  targetUrl?: string;
  searchTerm?: string;
};

export function getPreferredUserName(name?: string | null): string {
  const normalized = name?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || "Usuário";
}

export function getAgentActionAnnouncement(action: AgentActionLike, userName?: string | null): string {
  const name = getPreferredUserName(userName);
  if (action.type === "agenda") return `${name}, vou consultar sua agenda agora.`;
  if (action.type === "search") return `${name}, vou pesquisar por ${action.searchTerm || "esse item"}.`;
  if (action.type === "navigate") {
    const taskMatch = action.targetUrl?.match(/^\/tasks\/(\d+)$/);
    if (taskMatch) return `${name}, vou abrir a tarefa número ${taskMatch[1]}.`;
    const routeLabels: Record<string, string> = {
      "/kanban": "o Kanban",
      "/calendar": "o calendário",
      "/projects": "os projetos",
      "/gantt": "o cronograma Gantt",
      "/sprints": "as Sprints",
      "/relatorios": "os relatórios",
      "/dashboard": "o Dashboard",
    };
    return `${name}, vou abrir ${routeLabels[action.targetUrl || ""] || "a área solicitada"}.`;
  }
  return `${name}, vou analisar sua solicitação.`;
}

export function personalizeAssistantReply(reply: string, userName?: string | null): string {
  return `${getPreferredUserName(userName)}, ${reply.trim()}`;
}

export function getSpeechPlaybackMessage(state: SpeechPlaybackState): string {
  switch (state) {
    case "speaking":
      return "Lendo a resposta do Orbita em voz alta.";
    case "paused":
      return "Leitura pausada. Você pode retomar ou parar.";
    case "unsupported":
      return "A síntese de voz não está disponível neste navegador. A resposta escrita continua disponível.";
    case "error":
      return "Não foi possível reproduzir a resposta em voz alta. A resposta escrita continua disponível.";
    default:
      return "A resposta também pode ser lida em voz alta pelo navegador.";
  }
}
