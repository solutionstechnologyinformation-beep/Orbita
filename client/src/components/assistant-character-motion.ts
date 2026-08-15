export const ASSISTANT_CHARACTER_FLOAT_CLASS = "orbita-assistant-character-float";
export const ASSISTANT_CHARACTER_ENTRY_CLASS = "orbita-assistant-character-entry";
export const ASSISTANT_CHARACTER_HOVER_PULSE_CLASS = "orbita-avatar-hover-pulse";

export function getAssistantCharacterMotionClass(isOpen: boolean): string {
  return isOpen ? ASSISTANT_CHARACTER_ENTRY_CLASS : ASSISTANT_CHARACTER_FLOAT_CLASS;
}
