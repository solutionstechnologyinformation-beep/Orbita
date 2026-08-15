import { describe, expect, it } from "vitest";
import {
  ASSISTANT_CHARACTER_ENTRY_CLASS,
  ASSISTANT_CHARACTER_FLOAT_CLASS,
  getAssistantCharacterMotionClass,
} from "./assistant-character-motion";

describe("assistant character motion", () => {
  it("uses the entry animation while the conversation box is open", () => {
    expect(getAssistantCharacterMotionClass(true)).toBe(ASSISTANT_CHARACTER_ENTRY_CLASS);
  });

  it("uses the subtle floating animation while the conversation box is closed", () => {
    expect(getAssistantCharacterMotionClass(false)).toBe(ASSISTANT_CHARACTER_FLOAT_CLASS);
  });
});
