import { describe, expect, it } from "vitest";
import { addUserAiMemory, getUserAiMemories, deleteUserAiMemory } from "./db";

describe("AI Assistant Memory & Learning System", () => {
  it("allows saving, listing and deleting persistent user memories securely", async () => {
    const testUserId = 9999;
    const memoryContent = "Prefiro prioridade alta nas tarefas de pavimentação";
    
    const memId = await addUserAiMemory(testUserId, memoryContent, "preference");
    expect(memId).toBeGreaterThan(0);

    const memories = await getUserAiMemories(testUserId);
    expect(memories.length).toBeGreaterThan(0);
    const found = memories.find((m: any) => m.id === memId);
    expect(found).toBeDefined();
    expect(found.content).toBe(memoryContent);
    expect(found.category).toBe("preference");

    await deleteUserAiMemory(memId, testUserId);
    const afterDelete = await getUserAiMemories(testUserId);
    expect(afterDelete.some((m: any) => m.id === memId)).toBe(false);
  });
});
