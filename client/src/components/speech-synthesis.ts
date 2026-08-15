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
    .replace(/[📊📌✅⚠️🔴🟡🟢]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
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
