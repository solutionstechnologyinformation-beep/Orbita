import { describe, expect, it } from "vitest";
import { getCompanyMigrationSnapshot, generateMigrationExcelBuffer, summarizeMigrationImportLog } from "./migration-export";
import ExcelJS from "exceljs";

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
    const buffer = await generateMigrationExcelBuffer(snapshot);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets[0]?.name).toBe("Órbita-Capa");
    const coverSheet = workbook.getWorksheet("Órbita-Capa");
    expect(coverSheet?.getCell("A1").value).toBe("ÓRBITA · PLANEJAMENTO VISUAL");
    expect(coverSheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });

    const empresasSheet = workbook.getWorksheet("Empresas");
    expect(empresasSheet).toBeDefined();
    expect(empresasSheet?.autoFilter).toBeDefined();
    expect(empresasSheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(empresasSheet?.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(empresasSheet?.getRow(1).getCell(1).fill).toMatchObject({ type: "pattern", pattern: "solid" });
  });
});
