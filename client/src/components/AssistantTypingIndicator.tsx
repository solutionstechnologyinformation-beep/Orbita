export const ASSISTANT_TYPING_LABEL = "Assistente Orbita está digitando";

export function getTypingDotDelay(index: number): string {
  return `${index * 140}ms`;
}

export function AssistantTypingIndicator({ label = ASSISTANT_TYPING_LABEL }: { label?: string }) {
  return (
    <div
      className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-500 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="orbita-assistant-typing-dot h-2 w-2 rounded-full bg-slate-500"
            style={{ animationDelay: getTypingDotDelay(index) }}
          />
        ))}
      </span>
      <span aria-hidden="true">Digitando</span>
    </div>
  );
}
