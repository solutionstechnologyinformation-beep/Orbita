import { Brain, Loader2 } from "lucide-react";

export function WorkloadAnalysisLoading() {
  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label="A IA está analisando as demandas abertas e preparando sugestões de distribuição da equipe"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-amber-950">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-amber-800">
          <Brain className="h-4 w-4" aria-hidden="true" />
          <Loader2 className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-spin motion-reduce:animate-none text-amber-700" aria-hidden="true" />
        </span>
        <span>Analisando as demandas da equipe...</span>
      </div>
      <div className="mt-3 space-y-2" aria-hidden="true">
        <div className="h-2.5 w-4/5 animate-pulse motion-reduce:animate-none rounded-full bg-amber-200" />
        <div className="h-2.5 w-3/5 animate-pulse motion-reduce:animate-none rounded-full bg-amber-200" />
        <div className="h-2.5 w-2/3 animate-pulse motion-reduce:animate-none rounded-full bg-amber-200" />
      </div>
      <p className="mt-2 text-xs text-amber-800">Comparando carga, prazos e responsáveis disponíveis.</p>
    </div>
  );
}
