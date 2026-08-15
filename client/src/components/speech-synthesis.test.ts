import { describe, expect, it } from "vitest";
import { getAgentActionAnnouncement, getBestPortugueseVoice, getPreferredUserName, getSpeechPlaybackMessage, getSpeechSynthesis, personalizeAssistantReply, stripTextForSpeech } from "./speech-synthesis";

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

  it("personalizes action announcements and replies without accepting unsafe line breaks", () => {
    expect(getPreferredUserName(["Luiz", "Otávio"].join(String.fromCharCode(10)))).toBe("Luiz Otávio");
    expect(getPreferredUserName(null)).toBe("Usuário");
    expect(getAgentActionAnnouncement({ type: "navigate", targetUrl: "/kanban" }, "Luiz Otávio"))
      .toContain("Luiz Otávio, vou abrir o Kanban");
    expect(getAgentActionAnnouncement({ type: "search", searchTerm: "tarefa 42" }, "Luiz Otávio"))
      .toContain("vou pesquisar por tarefa 42");
    expect(personalizeAssistantReply("Relatório pronto.", "Luiz Otávio"))
      .toBe("Luiz Otávio, Relatório pronto.");
  });

  it("exposes accessible playback status messages", () => {
    expect(getSpeechPlaybackMessage("speaking")).toContain("voz alta");
    expect(getSpeechPlaybackMessage("paused")).toContain("pausada");
    expect(getSpeechPlaybackMessage("unsupported")).toContain("resposta escrita");
  });
});

  it("selects best portuguese voice when available", () => {
    const mockSynthesis = {
      speak: () => {},
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      getVoices: () => [
        { name: "English Voice", lang: "en-US" },
        { name: "Google Portuguese Brazil", lang: "pt-BR" },
      ],
    };
    const voice = getBestPortugueseVoice(mockSynthesis);
    expect(voice).toBeDefined();
    expect(voice?.lang).toBe("pt-BR");
  });
