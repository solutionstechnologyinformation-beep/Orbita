export const ASSISTANT_CHARACTER_FLOAT_CLASS = "orbita-assistant-character-float";
export const ASSISTANT_CHARACTER_ENTRY_CLASS = "orbita-assistant-character-entry";

export function getAssistantCharacterMotionClass(isOpen: boolean): string {
  return isOpen ? ASSISTANT_CHARACTER_ENTRY_CLASS : ASSISTANT_CHARACTER_FLOAT_CLASS;
}
