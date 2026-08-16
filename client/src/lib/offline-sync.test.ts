import { describe, expect, it, beforeEach } from "vitest";
import {
  clearOfflineDrafts,
  getOfflineDraftCount,
  getOfflineDrafts,
  getPendingOfflineDrafts,
  removeOfflineDraft,
  saveOfflineDraft,
  updateOfflineDraftStatus,
} from "./offline-sync";

describe("Offline Drafts Sync Manager", () => {
  beforeEach(() => {
    clearOfflineDrafts();
  });

  it("starts with zero drafts", () => {
    expect(getOfflineDrafts()).toHaveLength(0);
    expect(getOfflineDraftCount()).toBe(0);
  });

  it("saves drafts as pending and exposes the pending count", () => {
    const draft = saveOfflineDraft("task", { title: "Tarefa Offline #1", projectId: 1 });
    const drafts = getOfflineDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(draft.id);
    expect(drafts[0].status).toBe("pending");
    expect(getPendingOfflineDrafts()).toHaveLength(1);
    expect(getOfflineDraftCount()).toBe(1);
  });

  it("tracks syncing, synced and error states", () => {
    const draft = saveOfflineDraft("comment", { content: "Comentário offline" });

    updateOfflineDraftStatus(draft.id, "syncing");
    expect(getOfflineDrafts()[0].status).toBe("syncing");
    expect(getOfflineDraftCount()).toBe(0);

    updateOfflineDraftStatus(draft.id, "error", "Falha temporária");
    expect(getOfflineDrafts()[0].status).toBe("error");
    expect(getOfflineDrafts()[0].errorMessage).toBe("Falha temporária");
    expect(getOfflineDraftCount()).toBe(1);

    const synced = updateOfflineDraftStatus(draft.id, "synced");
    expect(synced?.syncedAt).toEqual(expect.any(Number));
    expect(getOfflineDraftCount()).toBe(0);
  });

  it("removes draft by id", () => {
    const draft1 = saveOfflineDraft("comment", { content: "Comentário 1" });
    const draft2 = saveOfflineDraft("comment", { content: "Comentário 2" });
    expect(getOfflineDrafts()).toHaveLength(2);

    removeOfflineDraft(draft1.id);
    const remaining = getOfflineDrafts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload.content).toBe("Comentário 2");
  });
});
