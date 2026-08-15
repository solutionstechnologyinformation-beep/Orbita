import { CalendarDays } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type GlobalPeriodPreset = "all" | "this-month" | "next-30-days" | "this-quarter" | "this-year" | "custom";

export type GlobalPeriodRange = {
  start: Date | null;
  end: Date | null;
};

export const GLOBAL_PERIOD_OPTIONS: Array<{ value: GlobalPeriodPreset; label: string }> = [
  { value: "all", label: "Todos os períodos" },
  { value: "this-month", label: "Este mês" },
  { value: "next-30-days", label: "Próximos 30 dias" },
  { value: "this-quarter", label: "Este trimestre" },
  { value: "this-year", label: "Este ano" },
  { value: "custom", label: "Período personalizado" },
];

type GlobalPeriodContextValue = {
  preset: GlobalPeriodPreset;
  customStart: string;
  customEnd: string;
  range: GlobalPeriodRange;
  label: string;
  setPreset: (preset: GlobalPeriodPreset) => void;
  setCustomStart: (value: string) => void;
  setCustomEnd: (value: string) => void;
  reset: () => void;
};

const GlobalPeriodContext = createContext<GlobalPeriodContextValue | null>(null);

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function parseDateInput(value: string, end = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return end ? endOfDay(date) : startOfDay(date);
}

export function getGlobalPeriodRange(preset: GlobalPeriodPreset, customStart = "", customEnd = "", now = new Date()): GlobalPeriodRange {
  if (preset === "all") return { start: null, end: null };
  if (preset === "custom") {
    return { start: parseDateInput(customStart), end: parseDateInput(customEnd, true) };
  }

  const today = startOfDay(now);
  if (preset === "this-month") {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
  }
  if (preset === "next-30-days") {
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return { start: today, end: endOfDay(end) };
  }
  if (preset === "this-quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { start: new Date(today.getFullYear(), quarterStartMonth, 1), end: endOfDay(new Date(today.getFullYear(), quarterStartMonth + 3, 0)) };
  }
  return { start: new Date(today.getFullYear(), 0, 1), end: endOfDay(new Date(today.getFullYear(), 12, 0)) };
}

export function isDateInGlobalPeriod(value: Date | string | number | null | undefined, range: GlobalPeriodRange) {
  if (!value || !range.start || !range.end) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

export function dateRangeOverlapsGlobalPeriod(startValue: Date | string | number | null | undefined, endValue: Date | string | number | null | undefined, range: GlobalPeriodRange) {
  if (!range.start || !range.end) return true;
  const start = startValue ? new Date(startValue) : endValue ? new Date(endValue) : null;
  const end = endValue ? new Date(endValue) : start;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= range.end && end >= range.start;
}

export function useGlobalPeriod() {
  const context = useContext(GlobalPeriodContext);
  if (!context) throw new Error("useGlobalPeriod deve ser usado dentro de GlobalPeriodProvider");
  return context;
}

export function GlobalPeriodProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<GlobalPeriodPreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const range = useMemo(() => getGlobalPeriodRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const optionLabel = GLOBAL_PERIOD_OPTIONS.find((option) => option.value === preset)?.label ?? "Todos os períodos";
  const label = preset === "custom" && (customStart || customEnd) ? `${customStart || "…"} → ${customEnd || "…"}` : optionLabel;
  const reset = useCallback(() => {
    setPreset("all");
    setCustomStart("");
    setCustomEnd("");
  }, []);

  const value = useMemo(() => ({ preset, customStart, customEnd, range, label, setPreset, setCustomStart, setCustomEnd, reset }), [preset, customStart, customEnd, range, label, reset]);
  return <GlobalPeriodContext.Provider value={value}>{children}</GlobalPeriodContext.Provider>;
}

export function GlobalPeriodControl({ className = "" }: { className?: string }) {
  const { preset, customStart, customEnd, label, setPreset, setCustomStart, setCustomEnd } = useGlobalPeriod();
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm ${className}`}>
      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <label htmlFor="global-period-filter" className="font-semibold text-foreground">Período</label>
      <select
        id="global-period-filter"
        value={preset}
        onChange={(event) => setPreset(event.target.value as GlobalPeriodPreset)}
        className="min-w-[132px] max-w-full bg-transparent font-semibold text-foreground outline-none"
        aria-label={`Filtro global por período. Selecionado: ${label}`}
      >
        {GLOBAL_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5 border-l border-border pl-2">
          <label htmlFor="global-period-start" className="sr-only">Data inicial</label>
          <input id="global-period-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="w-[8.5rem] bg-transparent text-foreground outline-none" aria-label="Data inicial do período" />
          <span className="text-muted-foreground" aria-hidden="true">→</span>
          <label htmlFor="global-period-end" className="sr-only">Data final</label>
          <input id="global-period-end" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="w-[8.5rem] bg-transparent text-foreground outline-none" aria-label="Data final do período" />
        </div>
      )}
    </div>
  );
}
