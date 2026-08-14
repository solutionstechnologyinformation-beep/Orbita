import { isRecentlyOnline } from "../../../shared/presence";

interface PresenceDotProps {
  lastSeenAt?: Date | string | number | null;
  className?: string;
}

export function PresenceDot({ lastSeenAt, className = "" }: PresenceDotProps) {
  const online = isRecentlyOnline(lastSeenAt);
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-card ${online ? "bg-emerald-500" : "bg-slate-300"} ${className}`}
      role="status"
      aria-label={online ? "Online" : "Offline"}
      title={online ? "Online" : "Offline"}
    />
  );
}
