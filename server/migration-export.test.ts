import { describe, expect, it } from "vitest";
import { getCompanyMigrationSnapshot, generateMigrationExcelBuffer, summarizeMigrationImportLog } from "./migration-export";
import * as XLSX from "xlsx";

describe("Migration Export and Import", () => {
  it("builds a migration snapshot successfully", async () => {
    const snapshot = await getCompanyMigrationSnapshot(null);
    expect(snapshot).toBeDefined();
    expect(snapshot.version).toBe("1.1.0");
    expect(snapshot.data).toHaveProperty("clients");
    expect(snapshot.data).toHaveProperty("crs");
    expect(snapshot.data).toHaveProperty("tasks");
  });

  it("summarizes detailed import log statuses", () => {
    const summary = summarizeMigrationImportLog([
      { entity: "clients", index: 0, status: "inserted", label: "Cliente A", message: "Registro inserido com sucesso." },
      { entity: "tasks", index: 1, status: "ignored", label: "Registro 2", message: "Registro ignorado." },
      { entity: "tasks", index: 2, status: "error", label: "Tarefa B", message: "Falha ao inserir." },
    ]);
    expect(summary).toEqual({ inserted: 1, ignored: 1, error: 1 });
  });

  it("generates an Excel buffer with multiple tabs", async () => {
    const snapshot = await getCompanyMigrationSnapshot(null);
    const buffer = generateMigrationExcelBuffer(snapshot);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames[0]).toBe("Órbita-Capa");
    const coverRows = XLSX.utils.sheet_to_json(workbook.Sheets["Órbita-Capa"], { header: 1 }) as unknown[][];
    expect(coverRows[0]?.[0]).toBe("ÓRBITA · PLANEJAMENTO VISUAL");
    expect(coverRows[3]).toEqual(["Indicador", "Valor"]);
  });
});
