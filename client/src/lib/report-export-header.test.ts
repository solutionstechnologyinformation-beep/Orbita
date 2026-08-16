import { describe, expect, it } from "vitest";
import { buildOrbitaCsvPreamble, ORBITA_CSV_BRAND_LINE } from "../../../shared/report-export-header";

describe("Orbita CSV report header", () => {
  it("creates a readable branding preamble before tabular data", () => {
    const preamble = buildOrbitaCsvPreamble("Relatório de Elementos do Mapa", new Date("2026-08-16T12:00:00.000Z"));

    expect(preamble.split("\r\n")).toEqual([
      ORBITA_CSV_BRAND_LINE,
      "# Relatório de Elementos do Mapa",
      expect.stringContaining("# Gerado em:"),
      "",
    ]);
  });
});
