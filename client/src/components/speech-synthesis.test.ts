import { describe, expect, it } from "vitest";
import { getSpeechPlaybackMessage, getSpeechSynthesis, stripTextForSpeech } from "./speech-synthesis";

describe("speech synthesis adapter", () => {
  it("removes markdown and visual symbols before speaking", () => {
    expect(stripTextForSpeech("📊 **Relatório** [abrir](/relatorios)"))
      .toBe("Relatório abrir");
  });

  it("detects native speech synthesis only when both APIs exist", () => {
    class FakeUtterance {
      constructor(public text: string) {}
    }
    const synthesis = { speak: () => undefined, cancel: () => undefined, pause: () => undefined, resume: () => undefined };
    const supportedWindow = {
      speechSynthesis: synthesis,
      SpeechSynthesisUtterance: FakeUtterance,
    } as unknown as Window;

    expect(getSpeechSynthesis(supportedWindow)).toMatchObject({ synthesis, Utterance: FakeUtterance });
    expect(getSpeechSynthesis({} as Window)).toBeNull();
    expect(getSpeechSynthesis(undefined)).toBeNull();
  });

  it("exposes accessible playback status messages", () => {
    expect(getSpeechPlaybackMessage("speaking")).toContain("voz alta");
    expect(getSpeechPlaybackMessage("paused")).toContain("pausada");
    expect(getSpeechPlaybackMessage("unsupported")).toContain("resposta escrita");
  });
});
