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
