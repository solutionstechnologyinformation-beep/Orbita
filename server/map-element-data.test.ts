import { describe, expect, it } from "vitest";
import { buildMapElementsCsv, escapeCsvCell, extractMapElementRecords } from "../shared/map-element-data";

describe("map element data", () => {
  it("extrai pontos e linhas com descrição e centro geográfico", () => {
    const segments = [{
      id: 7,
      crsId: 19,
      name: "GO-319",
      crsName: "Contrato GO-319",
      tipoObra: "implementacao",
      extensaoKm: 45.3,
      geometryJson: JSON.stringify({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { name: "KM 220", description: "Marco inicial" }, geometry: { type: "Point", coordinates: [-49.7, -17.1] } },
          { type: "Feature", properties: { name: "Trecho principal", description: "KM 220 a 230" }, geometry: { type: "LineString", coordinates: [[-49.7, -17.1], [-49.8, -17.2]] } },
        ],
      }),
    }];

    const records = extractMapElementRecords(segments);
    expect(records).toHaveLength(2);
    expect(records[0].geometryType).toBe("Point");
    expect(records[0].description).toBe("Marco inicial");
    expect(records[1].center).toEqual({ lat: -17.15, lng: -49.75 });
  });

  it("escapa células e mantém informações no CSV", () => {
    expect(escapeCsvCell("Trecho, principal")).toBe('"Trecho, principal"');
    const csv = buildMapElementsCsv([{ key: "1:0", segmentId: 1, segmentName: "Arquivo", crsId: 1, crsName: "Contrato", geometryType: "Point", elementName: "KM 220", description: "SRE, trecho", attributes: "", coordinates: [[-49.7, -17.1]], center: { lat: -17.1, lng: -49.7 }, workType: "", extensionKm: null }]);
    expect(csv).toContain("Elemento,Tipo de geometria,Contrato");
    expect(csv).toContain('"SRE, trecho"');
  });
});
