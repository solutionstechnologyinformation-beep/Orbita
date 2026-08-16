export type OfflineDraft = {
  id: string;
  type: "task" | "comment" | "project";
  payload: Record<string, any>;
  createdAt: number;
};

const DRAFTS_KEY = "orbita_offline_drafts_v1";

// Fallback memory store for Node test environment where localStorage might be mocked or volatile
let memoryStore: OfflineDraft[] = [];

export function getOfflineDrafts(): OfflineDraft[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(DRAFTS_KEY);
      if (raw) {
        return JSON.parse(raw) as OfflineDraft[];
      }
    }
  } catch {}
  return memoryStore;
}

export function saveOfflineDraft(type: "task" | "comment" | "project", payload: Record<string, any>): OfflineDraft {
  const drafts = getOfflineDrafts();
  const newDraft: OfflineDraft = {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: Date.now(),
  };
  drafts.push(newDraft);
  memoryStore = [...drafts];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    }
  } catch (err) {
    console.error("[OfflineSync] Failed to save draft:", err);
  }
  return newDraft;
}

export function removeOfflineDraft(id: string): void {
  const drafts = getOfflineDrafts();
  const filtered = drafts.filter(d => d.id !== id);
  memoryStore = [...filtered];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error("[OfflineSync] Failed to remove draft:", err);
  }
}

export function clearOfflineDrafts(): void {
  memoryStore = [];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DRAFTS_KEY);
    }
  } catch {}
}
