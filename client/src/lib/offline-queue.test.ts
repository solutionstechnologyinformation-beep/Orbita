import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearOfflineDrafts, saveOfflineDraft, getOfflineDrafts } from "./offline-sync";
import { processOfflineQueue } from "./offline-queue";

describe("Offline Queue Processor & Retry", () => {
  beforeEach(() => {
    clearOfflineDrafts();
  });

  it("processes pending drafts successfully", async () => {
    saveOfflineDraft("task", { title: "Tarefa Sync #1", projectId: 1, status: "todo", priority: "medium" });
    const mockClient = {
      tasks: {
        create: { mutateAsync: vi.fn().mockResolvedValue({ success: true }) },
      },
    };

    const res = await processOfflineQueue(mockClient, { backoffBaseMs: 0 });
    expect(res.successCount).toBe(1);
    expect(res.errorCount).toBe(0);
    expect(getOfflineDrafts()).toHaveLength(0);
  });

  it("retries failed items and marks as error after max attempts", async () => {
    saveOfflineDraft("task", { title: "Tarefa Com Falha", projectId: 1, status: "todo", priority: "medium" });
    const mockClient = {
      tasks: {
        create: { mutateAsync: vi.fn().mockRejectedValue(new Error("Servidor indisponível")) },
      },
    };

    const res = await processOfflineQueue(mockClient, { backoffBaseMs: 0 });
    expect(res.successCount).toBe(0);
    expect(res.errorCount).toBe(1);

    const drafts = getOfflineDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe("error");
    expect(drafts[0].errorMessage).toBe("Servidor indisponível");
  });
});
