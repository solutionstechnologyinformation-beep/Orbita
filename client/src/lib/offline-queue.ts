import {
  getPendingOfflineDrafts,
  recordOfflineDraftAttempt,
  removeOfflineDraft,
  updateOfflineDraftStatus,
} from "./offline-sync";

type SyncClient = {
  tasks: {
    create: { mutateAsync: (input: any) => Promise<any> };
    addComment: { mutateAsync: (input: any) => Promise<any> };
  };
};

export type SyncQueueOptions = {
  maxAttempts?: number;
  backoffBaseMs?: number;
  isOnline?: () => boolean;
  force?: boolean;
};

let isSyncing = false;

const sleep = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

export async function processOfflineQueue(
  trpcClient: SyncClient,
  options: SyncQueueOptions = {},
): Promise<{ successCount: number; errorCount: number }> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const backoffBaseMs = Math.max(0, options.backoffBaseMs ?? 1000);
  const isOnline = options.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);

  if (isSyncing || !isOnline()) return { successCount: 0, errorCount: 0 };
  isSyncing = true;

  let successCount = 0;
  let errorCount = 0;

  try {
    const now = Date.now();
    const pending = getPendingOfflineDrafts().filter((draft) => options.force || !draft.nextRetryAt || draft.nextRetryAt <= now);
    for (const draft of pending) {
      if (!isOnline()) break;
      updateOfflineDraftStatus(draft.id, "syncing");
      let synced = false;
      let attemptNumber = draft.attempts;

      while (attemptNumber < maxAttempts && !synced) {
        if (!isOnline()) break;
        const attempt = recordOfflineDraftAttempt(draft.id);
        attemptNumber = attempt?.attempts ?? attemptNumber + 1;

        try {
          if (draft.type === "task") {
            await trpcClient.tasks.create.mutateAsync(draft.payload);
          } else if (draft.type === "comment") {
            await trpcClient.tasks.addComment.mutateAsync(draft.payload);
          } else {
            throw new Error("Tipo de rascunho ainda não possui sincronização automática.");
          }

          updateOfflineDraftStatus(draft.id, "synced");
          removeOfflineDraft(draft.id);
          successCount++;
          synced = true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Erro ao sincronizar";
          if (attemptNumber >= maxAttempts) {
            updateOfflineDraftStatus(draft.id, "error", message);
            errorCount++;
          } else {
            updateOfflineDraftStatus(draft.id, "pending", message);
            await sleep(backoffBaseMs * 2 ** (attemptNumber - 1));
          }
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  return { successCount, errorCount };
}
