import { describe, expect, it } from "vitest";
import {
  containsWakePhrase,
  extractFinalTranscript,
  extractLatestTranscript,
  getCommandAfterWakePhrase,
  getSpeechRecognitionConstructor,
  getVoiceErrorState,
  getVoiceStatusMessage,
} from "./voice-recognition";

describe("voice recognition adapter", () => {
  it("prefers native SpeechRecognition and falls back to webkitSpeechRecognition", () => {
    class NativeRecognition {}
    class WebkitRecognition {}
    const nativeWindow = { SpeechRecognition: NativeRecognition } as unknown as Window;
    const webkitWindow = { webkitSpeechRecognition: WebkitRecognition } as unknown as Window;

    expect(getSpeechRecognitionConstructor(nativeWindow)).toBe(NativeRecognition);
    expect(getSpeechRecognitionConstructor(webkitWindow)).toBe(WebkitRecognition);
    expect(getSpeechRecognitionConstructor(undefined)).toBeNull();
  });

  it("extracts a clean transcript from the first result", () => {
    const event = {
      results: [[{ transcript: "  abrir o kanban  " }]],
    } as any;

    expect(extractFinalTranscript(event)).toBe("abrir o kanban");
    expect(extractFinalTranscript({ results: [] } as any)).toBe("");
  });

  it("detects the Portuguese wake phrase and extracts an optional command", () => {
    expect(containsWakePhrase("Olá, Órbita!")).toBe(true);
    expect(containsWakePhrase("abrir o Kanban")).toBe(false);
    expect(getCommandAfterWakePhrase("Olá Órbita, abrir o Kanban")).toBe("abrir o kanban");
    expect(getCommandAfterWakePhrase("comando sem ativação")).toBe("");
    expect(extractLatestTranscript({ results: [[{ transcript: "primeiro" }], [{ transcript: "Olá Órbita" }]] } as any)).toBe("Olá Órbita");
  });

  it("maps microphone permission errors without exposing audio data", () => {
    expect(getVoiceErrorState("not-allowed")).toBe("permission-denied");
    expect(getVoiceErrorState("service-not-allowed")).toBe("permission-denied");
    expect(getVoiceErrorState("network")).toBe("error");
    expect(getVoiceStatusMessage("idle")).toContain("não é salvo");
    expect(getVoiceStatusMessage("unsupported")).toContain("digitação");
  });
});
