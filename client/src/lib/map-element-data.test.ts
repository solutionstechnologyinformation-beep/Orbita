import { describe, expect, it } from "vitest";
import { buildMapElementsCsv, type MapElementRecord } from "../../../shared/map-element-data";

describe("map element CSV export", () => {
  it("adds the Orbita header without removing the tabular header or records", () => {
    const record: MapElementRecord = {
      key: "1:0",
      segmentId: 1,
      segmentName: "Trecho BH",
      crsId: 2,
      crsName: "Contrato BH Shopping",
      geometryType: "LineString",
      elementName: "Trecho principal",
      description: "Descrição do trecho",
      attributes: "{\"status\":\"ativo\"}",
      coordinates: [[-43.9, -19.9]],
      center: { lat: -19.9, lng: -43.9 },
      workType: "Implantação",
      extensionKm: 12.5,
    };

    const csv = buildMapElementsCsv([record]);

    expect(csv.startsWith("# ÓRBITA · PLANEJAMENTO VISUAL")).toBe(true);
    expect(csv).toContain("Elemento,Tipo de geometria,Contrato");
    expect(csv).toContain("Trecho principal");
    expect(csv).toContain("12.5");
  });
});
