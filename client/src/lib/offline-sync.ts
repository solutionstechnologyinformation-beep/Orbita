export type OfflineDraftStatus = "pending" | "syncing" | "synced" | "error";

export type OfflineDraft = {
  id: string;
  type: "task" | "comment" | "project";
  payload: Record<string, any>;
  createdAt: number;
  status: OfflineDraftStatus;
  attempts: number;
  errorMessage?: string;
  syncedAt?: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
};

const DRAFTS_KEY = "orbita_offline_drafts_v1";
let memoryStore: OfflineDraft[] = [];
const listeners = new Set<() => void>();

function normalizeDraft(draft: OfflineDraft): OfflineDraft {
  return { ...draft, status: draft.status ?? "pending", attempts: draft.attempts ?? 0 };
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function persist(drafts: OfflineDraft[]) {
  memoryStore = drafts.map(normalizeDraft);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(memoryStore));
    }
  } catch (err) {
    console.error("[OfflineSync] Failed to persist drafts:", err);
  }
  emitChange();
}

export function getOfflineDrafts(): OfflineDraft[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(DRAFTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OfflineDraft[];
        memoryStore = parsed.map(normalizeDraft);
        return memoryStore;
      }
    }
  } catch {
    // Fall back to the in-memory copy when local storage is unavailable/corrupt.
  }
  return memoryStore.map(normalizeDraft);
}

export function getPendingOfflineDrafts(): OfflineDraft[] {
  return getOfflineDrafts().filter((draft) => draft.status === "pending" || draft.status === "error");
}

export function getOfflineDraftCount(): number {
  return getPendingOfflineDrafts().length;
}

export function subscribeOfflineDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveOfflineDraft(type: "task" | "comment" | "project", payload: Record<string, any>): OfflineDraft {
  const newDraft: OfflineDraft = {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
  };
  persist([...getOfflineDrafts(), newDraft]);
  return newDraft;
}

export function recordOfflineDraftAttempt(id: string): OfflineDraft | undefined {
  const drafts = getOfflineDrafts();
  const target = drafts.find((draft) => draft.id === id);
  if (!target) return undefined;
  const updated = { ...target, attempts: target.attempts + 1, lastAttemptAt: Date.now() };
  persist(drafts.map((draft) => (draft.id === id ? updated : draft)));
  return updated;
}

export function updateOfflineDraftStatus(id: string, status: OfflineDraftStatus, errorMessage?: string): OfflineDraft | undefined {
  const drafts = getOfflineDrafts();
  const target = drafts.find((draft) => draft.id === id);
  if (!target) return undefined;

  const updated: OfflineDraft = {
    ...target,
    status,
    errorMessage: status === "error" ? errorMessage : undefined,
    syncedAt: status === "synced" ? Date.now() : target.syncedAt,
    nextRetryAt: status === "error" ? Date.now() + 30_000 : undefined,
  };
  persist(drafts.map((draft) => (draft.id === id ? updated : draft)));
  return updated;
}

export function removeOfflineDraft(id: string): void {
  persist(getOfflineDrafts().filter((draft) => draft.id !== id));
}

export function clearOfflineDrafts(): void {
  memoryStore = [];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DRAFTS_KEY);
    }
  } catch {}
  emitChange();
}
