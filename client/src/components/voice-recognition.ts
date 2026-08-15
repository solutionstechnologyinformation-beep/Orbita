export type VoiceRecognitionState = "idle" | "listening" | "unsupported" | "permission-denied" | "error";

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

export function getSpeechRecognitionConstructor(windowObject: Window | undefined = typeof window === "undefined" ? undefined : window): SpeechRecognitionConstructorLike | null {
  if (!windowObject) return null;
  const speechWindow = windowObject as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function getVoiceErrorState(errorCode?: string): Exclude<VoiceRecognitionState, "idle" | "listening" | "unsupported"> {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") return "permission-denied";
  return "error";
}

export function getVoiceStatusMessage(state: VoiceRecognitionState): string {
  switch (state) {
    case "listening":
      return "Estou ouvindo… fale um comando em português.";
    case "unsupported":
      return "O reconhecimento de voz não está disponível neste navegador. Use a digitação normalmente.";
    case "permission-denied":
      return "O acesso ao microfone foi bloqueado. Permita o microfone nas configurações do navegador ou use a digitação.";
    case "error":
      return "Não consegui entender o áudio. Tente novamente ou use a digitação.";
    default:
      return "O áudio é processado pelo reconhecimento nativo do navegador e não é salvo pelo Orbita.";
  }
}

export function extractFinalTranscript(event: SpeechRecognitionEventLike): string {
  const firstResult = event.results?.[0];
  const firstAlternative = firstResult?.[0];
  return typeof firstAlternative?.transcript === "string" ? firstAlternative.transcript.trim() : "";
}

export function extractLatestTranscript(event: SpeechRecognitionEventLike): string {
  const latestIndex = Math.max(0, event.results.length - 1);
  const latestResult = event.results?.[latestIndex];
  const firstAlternative = latestResult?.[0];
  return typeof firstAlternative?.transcript === "string" ? firstAlternative.transcript.trim() : "";
}

export function normalizeWakePhrase(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsWakePhrase(text: string): boolean {
  return normalizeWakePhrase(text).includes("ola orbita");
}

export function getCommandAfterWakePhrase(text: string): string {
  const normalized = normalizeWakePhrase(text);
  const phraseIndex = normalized.indexOf("ola orbita");
  if (phraseIndex < 0) return "";
  return normalized.slice(phraseIndex + "ola orbita".length).trim();
}
