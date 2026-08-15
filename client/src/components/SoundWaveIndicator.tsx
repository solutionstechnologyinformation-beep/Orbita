import type { CSSProperties } from "react";

export type SoundWaveState = "idle" | "listening" | "speaking" | "paused" | "error";

type SoundWaveIndicatorProps = {
  state: SoundWaveState;
  compact?: boolean;
  className?: string;
};

const STATE_LABELS: Record<SoundWaveState, string> = {
  idle: "Assistente em espera",
  listening: "Assistente ouvindo",
  speaking: "Assistente falando",
  paused: "Leitura de voz pausada",
  error: "Áudio indisponível",
};

const BAR_HEIGHTS = [0.38, 0.62, 0.92, 0.58, 0.78, 0.48, 0.7];

export function getSoundWaveLabel(state: SoundWaveState): string {
  return STATE_LABELS[state];
}

export function SoundWaveIndicator({ state, compact = false, className = "" }: SoundWaveIndicatorProps) {
  const isAnimated = state === "listening" || state === "speaking";
  const size = compact ? "h-5 w-7" : "h-7 w-10";
  const color = state === "listening" ? "bg-emerald-300" : state === "speaking" ? "bg-[#ffc30d]" : state === "error" ? "bg-red-300" : "bg-white/70";

  return (
    <span
      className={`orbita-sound-wave inline-flex ${size} items-center justify-center gap-0.5 rounded-md ${className}`}
      data-sound-wave-state={state}
      role="img"
      aria-label={STATE_LABELS[state]}
    >
      {BAR_HEIGHTS.map((height, index) => {
        const style = {
          height: `${Math.max(4, Math.round((compact ? 18 : 24) * height))}px`,
          animationDelay: `${index * 90}ms`,
          animationDuration: `${isAnimated && state === "speaking" ? 720 : 980}ms`,
        } satisfies CSSProperties;
        return (
          <span
            key={index}
            className={`orbita-sound-wave-bar w-0.5 rounded-full ${color} ${isAnimated ? "orbita-sound-wave-bar-active" : ""}`}
            style={style}
            aria-hidden="true"
          />
        );
      })}
    </span>
  );
}
