import { describe, expect, it } from "vitest";
import { ASSISTANT_TYPING_LABEL, getTypingDotDelay } from "./AssistantTypingIndicator";

describe("AssistantTypingIndicator", () => {
  it("exposes an accessible processing label", () => {
    expect(ASSISTANT_TYPING_LABEL).toBe("Assistente Orbita está digitando");
  });

  it("staggeres the three dots in a predictable rhythm", () => {
    expect([0, 1, 2].map(getTypingDotDelay)).toEqual(["0ms", "140ms", "280ms"]);
  });
});
