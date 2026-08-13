import { describe, expect, it } from "vitest";
import { getSegmentContentType, sanitizeSegmentFileName, validateSegmentGeometry } from "./crs-segments";

describe("crs-segments", () => {
  it("valida FeatureCollection com LineString", () => {
    const geometry = validateSegmentGeometry(JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[-48.1, -15.7], [-48.2, -15.8]] } }],
    }));
    expect(geometry.type).toBe("FeatureCollection");
    expect(geometry.features).toHaveLength(1);
  });

  it("rejeita geometria sem trechos lineares", () => {
    expect(() => validateSegmentGeometry(JSON.stringify({ type: "FeatureCollection", features: [] }))).toThrow("Nenhum trecho");
    expect(() => validateSegmentGeometry("não-json")).toThrow("Geometria inválida");
  });

  it("identifica content type e sanitiza nomes de arquivo", () => {
    expect(getSegmentContentType("rodovia.KMZ")).toBe("application/vnd.google-earth.kmz");
    expect(getSegmentContentType("rodovia.kml")).toBe("application/vnd.google-earth.kml+xml");
    expect(sanitizeSegmentFileName("trecho 01/área.kmz")).toBe("trecho-01--rea.kmz");
  });
});
