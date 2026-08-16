import { describe, expect, it, beforeEach } from "vitest";
import { getOfflineDrafts, saveOfflineDraft, removeOfflineDraft, clearOfflineDrafts } from "./offline-sync";

describe("Offline Drafts Sync Manager", () => {
  beforeEach(() => {
    clearOfflineDrafts();
  });

  it("starts with zero drafts", () => {
    expect(getOfflineDrafts()).toHaveLength(0);
  });

  it("saves and retrieves offline drafts correctly", () => {
    const draft = saveOfflineDraft("task", { title: "Tarefa Offline #1", projectId: 1 });
    const drafts = getOfflineDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(draft.id);
    expect(drafts[0].payload.title).toBe("Tarefa Offline #1");
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
