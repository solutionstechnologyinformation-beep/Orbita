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
    const femaleMarkers = /female|feminina|woman|mulher|samantha|helena|luciana|francisca|camila|letícia|leticia|bruna|ana/i;
    const maleMarkers = /male|masculina|man|homem|daniel|joão|joao|ricardo|felipe|antonio|antônio|carlos|marcos|thiago|guilherme/i;
    const naturalMarkers = /natural|enhanced|google|microsoft|online|neural/i;
    const maleVoices = ptVoices.filter((v: any) => v.name && maleMarkers.test(v.name) && !femaleMarkers.test(v.name));
    const naturalMaleVoice = maleVoices.find((v: any) => naturalMarkers.test(v.name));
    const namedMaleVoice = maleVoices[0];
    const naturalPt = ptVoices.find((v: any) => v.name && naturalMarkers.test(v.name) && !femaleMarkers.test(v.name));
    const brVoice = ptVoices.find((v: any) => v.lang.toLowerCase().includes("br") || v.lang.toLowerCase().includes("pt"));
    return naturalMaleVoice || namedMaleVoice || naturalPt || brVoice || ptVoices[0];
  } catch {
    return null;
  }
}

export type AgentActionLike = {
  type?: string;
  targetUrl?: string;
  searchTerm?: string;
  period?: string;
  layerType?: string;
  region?: string;
};

export function getPreferredUserName(name?: string | null): string {
  const normalized = name?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || "Usuário";
}

export function getAgentActionAnnouncement(action: AgentActionLike, userName?: string | null): string {
  if (action.type === "agenda") return "Consultando sua agenda.";
  if (action.type === "search") return `Pesquisando por ${action.searchTerm || "esse item"}.`;
  if (action.type === "analyze_workload") return "Avaliando as demandas abertas.";
  if (action.type === "generate_report_pdf") return `Emitindo o relatório de ${action.period || "período"}.`;
  if (action.type === "map_export_csv") return "Exportando os dados do mapa em CSV.";
  if (action.type === "map_toggle_layer") return `Alternando o mapa para o modo ${action.layerType === "satellite" ? "satélite" : "padrão"}.`;
  if (["map_focus", "map_filter_state", "map_highlight_contract"].includes(action.type ?? "")) {
    return `Direcionando para o ${action.region ? `estado de ${action.region}` : "mapa"}.`;
  }
  if (action.type === "navigate") {
    const taskMatch = action.targetUrl?.match(/^\/tasks\/(\d+)$/);
    if (taskMatch) return `Abrindo a tarefa número ${taskMatch[1]}.`;
    const routeLabels: Record<string, string> = {
      "/kanban": "te direcionando para o Kanban",
      "/calendar": "te direcionando para a agenda",
      "/projects": "te direcionando para os projetos",
      "/gantt": "te direcionando para o cronograma",
      "/sprints": "te direcionando para as Sprints",
      "/relatorios": "te direcionando para os relatórios",
      "/dashboard": "te direcionando para o mapa",
    };
    return routeLabels[action.targetUrl || ""] || "Executando navegação.";
  }
  return "";
}

export function personalizeAssistantReply(reply: string, userName?: string | null): string {
  return `${getPreferredUserName(userName)}, ${reply.trim()}`;
}

export function shouldSpeakClosingGreeting(isOpen: boolean, nextOpen: boolean): boolean {
  // A saudação de boas-vindas ocorre na primeira abertura da caixa de mensagem
  return !isOpen && nextOpen;
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
