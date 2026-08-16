import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, CloudOff, Database, Loader2, RefreshCw, Wifi } from "lucide-react";
import {
  getOfflineDrafts,
  getOfflineDraftCount,
  subscribeOfflineDrafts,
  type OfflineDraft,
} from "@/lib/offline-sync";

function subscribeNetwork(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getNetworkSnapshot() {
  return navigator.onLine;
}

function getServerNetworkSnapshot() {
  return true;
}

function draftLabel(draft: OfflineDraft) {
  const labels = { task: "Tarefa", comment: "Comentário", project: "Projeto" } as const;
  return labels[draft.type];
}

function draftTitle(draft: OfflineDraft) {
  const value = draft.payload.title ?? draft.payload.content ?? draft.payload.name;
  return typeof value === "string" && value.trim() ? value.trim() : "Item sem título";
}

export function OfflineSyncIndicator() {
  const isOnline = useSyncExternalStore(subscribeNetwork, getNetworkSnapshot, getServerNetworkSnapshot);
  const pendingCount = useSyncExternalStore(subscribeOfflineDrafts, getOfflineDraftCount, () => 0);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setReconnected(false);
      return;
    }
    if (pendingCount > 0) setReconnected(true);
  }, [isOnline, pendingCount]);

  useEffect(() => {
    if (!isOpen) return;
    setDrafts(getOfflineDrafts().filter((draft) => draft.status !== "synced"));
  }, [isOpen, pendingCount]);

  if (!isOpen && pendingCount === 0 && isOnline && !reconnected) return null;

  const hasErrors = drafts.some((draft) => draft.status === "error");
  const statusLabel = !isOnline
    ? `${pendingCount} pendente${pendingCount === 1 ? "" : "s"} · modo offline`
    : pendingCount > 0
      ? `${pendingCount} aguardando sincronização`
      : "Sincronização concluída";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          !isOnline || pendingCount > 0
            ? "bg-amber-500/15 text-amber-950 hover:bg-amber-500/25 dark:text-amber-200"
            : "bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/25 dark:text-emerald-200"
        }`}
        aria-expanded={isOpen}
        aria-controls="offline-sync-panel"
        aria-label={`Status de sincronização: ${statusLabel}`}
        title={statusLabel}
      >
        {!isOnline ? <CloudOff className="h-4 w-4" aria-hidden="true" /> : pendingCount > 0 ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden md:inline">{!isOnline ? "Offline" : pendingCount > 0 ? "Pendentes" : "Sincronizado"}</span>
        {pendingCount > 0 && <span className="min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-950">{pendingCount}</span>}
      </button>

      {isOpen && (
        <div id="offline-sync-panel" role="dialog" aria-label="Itens pendentes de sincronização" className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-start gap-3">
              {!isOnline ? <CloudOff className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden="true" /> : pendingCount > 0 ? <Wifi className="mt-0.5 h-5 w-5 text-blue-600" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{!isOnline ? "Modo offline ativo" : pendingCount > 0 ? "Sincronização pendente" : "Tudo sincronizado"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {!isOnline ? "Os dados abaixo permanecem salvos neste dispositivo." : pendingCount > 0 ? "Os itens serão enviados quando a sincronização estiver disponível." : "Não há rascunhos aguardando envio."}
                </p>
              </div>
            </div>
          </div>

          {reconnected && pendingCount > 0 && isOnline && (
            <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Conexão restabelecida. Preparando os itens pendentes.
            </div>
          )}

          {drafts.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto p-2">
              {drafts.map((draft) => (
                <div key={draft.id} className="flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/60">
                  <div className="mt-0.5 shrink-0">
                    {draft.status === "syncing" ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-label="Sincronizando" /> : draft.status === "error" ? <AlertCircle className="h-4 w-4 text-red-600" aria-label="Erro de sincronização" /> : <Database className="h-4 w-4 text-amber-600" aria-label="Pendente" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{draftTitle(draft)}</p>
                    <p className="text-[11px] text-muted-foreground">{draftLabel(draft)} · {draft.status === "error" ? draft.errorMessage || "Falha ao sincronizar" : draft.status === "syncing" ? "Sincronizando" : "Pendente de envio"}</p>
                  </div>
                  <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${draft.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : draft.status === "syncing" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                    {draft.status === "error" ? "Erro" : draft.status === "syncing" ? "Enviando" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Nenhum item pendente de sincronização.
            </div>
          )}

          {hasErrors && <p className="border-t border-border px-4 py-2 text-[11px] text-red-700 dark:text-red-300">Revise os itens com erro antes de tentar sincronizar novamente.</p>}
        </div>
      )}
    </div>
  );
}
