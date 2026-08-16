import { describe, expect, it } from "vitest";
import { getCompanyMigrationSnapshot, generateMigrationExcelBuffer } from "./migration-export";

describe("Migration Export and Import", () => {
  it("builds a migration snapshot successfully", async () => {
    const snapshot = await getCompanyMigrationSnapshot(null);
    expect(snapshot).toBeDefined();
    expect(snapshot.version).toBe("1.0.0");
    expect(snapshot.data).toHaveProperty("clients");
    expect(snapshot.data).toHaveProperty("crs");
    expect(snapshot.data).toHaveProperty("tasks");
  });

  it("generates an Excel buffer with multiple tabs", async () => {
    const snapshot = await getCompanyMigrationSnapshot(null);
    const buffer = generateMigrationExcelBuffer(snapshot);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
