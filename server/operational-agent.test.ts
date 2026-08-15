import { describe, expect, it } from "vitest";
import { processOperationalAgentCommand } from "./operational-agent";

describe("Operational Agent", () => {
  it("interprets map zoom and region command correctly", async () => {
    const res = await processOperationalAgentCommand(1, null, "Mostrar no mapa os trechos de Goiás");
    expect(res).toBeDefined();
    expect(res.reply).toContain("Goiás");
    expect(res.action.type).toBe("map_focus");
    expect(res.action.region).toBe("Goiás");
  });

  it("interprets PDF report generation command for a specific period", async () => {
    const res = await processOperationalAgentCommand(1, null, "Gerar relatório em PDF de agosto");
    expect(res).toBeDefined();
    expect(res.reply).toContain("Agosto");
    expect(res.action.type).toBe("generate_report_pdf");
    expect(res.action.period).toBe("Agosto");
  });
});

  it("interprets map CSV export command correctly", async () => {
    const res = await processOperationalAgentCommand(1, null, "Exportar dados do mapa em CSV");
    expect(res).toBeDefined();
    expect(res.reply).toContain("CSV");
    expect(res.action.type).toBe("map_export_csv");
  });

  it("interprets satellite layer toggle command correctly", async () => {
    const res = await processOperationalAgentCommand(1, null, "Mudar para o modo satélite");
    expect(res).toBeDefined();
    expect(res.reply).toContain("Satélite");
    expect(res.action.type).toBe("map_toggle_layer");
    expect(res.action.layerType).toBe("satellite");
  });
