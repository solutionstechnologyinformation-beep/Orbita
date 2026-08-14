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

  it("aceita geometrias maiores que 64 KB, como as geradas por KMZ detalhados", () => {
    const coordinates = Array.from({ length: 2_600 }, (_, index) => [-47.9 + index / 100_000, -17.1 - index / 100_000]);
    const payload = JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { name: "GO-319" }, geometry: { type: "LineString", coordinates } }],
    });
    expect(Buffer.byteLength(payload, "utf8")).toBeGreaterThan(65_535);
    expect(validateSegmentGeometry(payload).features).toHaveLength(1);
  });
});
