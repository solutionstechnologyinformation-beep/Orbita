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

  it("localiza o elemento selecionado pelo identificador e retorna nulo para seleção fechada", async () => {
    const { findMapElementRecord } = await import("../shared/map-element-data");
    const record = { key: "8:2", segmentId: 8, segmentName: "arquivo.kml", crsId: 9, crsName: "Contrato 9", geometryType: "Point" as const, elementName: "KM 220", description: "Marco", attributes: "", coordinates: [[-49.7, -17.1]], center: { lat: -17.1, lng: -49.7 }, workType: "", extensionKm: null };
    expect(findMapElementRecord([record], "8:2")).toEqual(record);
    expect(findMapElementRecord([record], null)).toBeNull();
    expect(findMapElementRecord([record], "missing")).toBeNull();
  });


describe("map element search", () => {
  it("filtra por nome, descrição ou atributo sem perder o limite de resultados", async () => {
    const { filterMapElementRecords } = await import("../shared/map-element-data");
    const base = (key: string, elementName: string, description: string, attributes: string) => ({
      key,
      segmentId: 1,
      segmentName: "trecho.kmz",
      crsId: 1,
      crsName: "Contrato GO-319",
      geometryType: "Point" as const,
      elementName,
      description,
      attributes,
      coordinates: [[-49.7, -17.1]],
      center: { lat: -17.1, lng: -49.7 },
      workType: "implementacao",
      extensionKm: null,
    });
    const records = [
      base("1:0", "Marco inicial", "Entrada da obra", "{\"codigo\":\"A-100\"}"),
      base("1:1", "Ponto técnico", "Travessia especial", "{\"codigo\":\"B-200\"}"),
      base("1:2", "Outro elemento", "Sem correspondência", "{\"codigo\":\"C-300\"}"),
    ];
    expect(filterMapElementRecords(records, "marco").map((record) => record.key)).toEqual(["1:0"]);
    expect(filterMapElementRecords(records, "travessia").map((record) => record.key)).toEqual(["1:1"]);
    expect(filterMapElementRecords(records, "B-200").map((record) => record.key)).toEqual(["1:1"]);
    expect(filterMapElementRecords(records, "", 2)).toHaveLength(2);
  });
});


describe("map element sorting", () => {
  it("ordena por nome ou agrupa por tipo de geometria", async () => {
    const { filterMapElementRecords } = await import("../shared/map-element-data");
    const makeRecord = (key: string, elementName: string, geometryType: "Point" | "LineString" | "MultiLineString") => ({
      key,
      segmentId: 1,
      segmentName: "trecho.kmz",
      crsId: 1,
      crsName: "Contrato",
      geometryType,
      elementName,
      description: "",
      attributes: "",
      coordinates: [[-49.7, -17.1]],
      center: { lat: -17.1, lng: -49.7 },
      workType: "",
      extensionKm: null,
    });
    const records = [
      makeRecord("1:0", "Zeta", "LineString"),
      makeRecord("1:1", "Alfa", "Point"),
      makeRecord("1:2", "Beta", "MultiLineString"),
    ];
    expect(filterMapElementRecords(records, "", 30, "alphabetical").map((record) => record.elementName)).toEqual(["Alfa", "Beta", "Zeta"]);
    expect(filterMapElementRecords(records, "", 30, "geometry").map((record) => record.geometryType)).toEqual(["Point", "LineString", "MultiLineString"]);
  });
});


describe("map element hover", () => {
  it("aplica destaque âmbar e restaura a cor base", async () => {
    const { getMapElementHighlightStyle } = await import("../shared/map-element-data");
    expect(getMapElementHighlightStyle(true, "#2563eb")).toEqual({ strokeColor: "#f59e0b", strokeOpacity: 1, strokeWeight: 8, zIndex: 120 });
    expect(getMapElementHighlightStyle(false, "#2563eb")).toEqual({ strokeColor: "#2563eb", strokeOpacity: 0.9, strokeWeight: 4, zIndex: 1 });
  });
});


describe("map element progressive list", () => {
  it("avança em lotes e nunca ultrapassa o total disponível", async () => {
    const { getNextMapElementVisibleCount } = await import("../shared/map-element-data");
    expect(getNextMapElementVisibleCount(0, 24)).toBe(8);
    expect(getNextMapElementVisibleCount(8, 24)).toBe(16);
    expect(getNextMapElementVisibleCount(20, 24)).toBe(24);
    expect(getNextMapElementVisibleCount(8, 24, 5)).toBe(13);
    expect(getNextMapElementVisibleCount(8, 0)).toBe(0);
  });
});


describe("map element panel state", () => {
  it("mantém loading durante a consulta e diferencia painel pronto de vazio", async () => {
    const { getMapElementPanelState } = await import("../shared/map-element-data");
    expect(getMapElementPanelState(true, 0)).toBe("loading");
    expect(getMapElementPanelState(true, 4)).toBe("loading");
    expect(getMapElementPanelState(false, 4)).toBe("ready");
    expect(getMapElementPanelState(false, 0)).toBe("empty");
  });
});


describe("map element attributes", () => {
  it("normaliza objetos JSON e valores não JSON em pares exibíveis", async () => {
    const { parseMapElementAttributes } = await import("../shared/map-element-data");
    expect(parseMapElementAttributes('{"codigo":"A-100","extensao":12.5}')).toEqual([
      { key: "codigo", value: "A-100" },
      { key: "extensao", value: "12.5" },
    ]);
    expect(parseMapElementAttributes("texto livre")).toEqual([{ key: "Atributos", value: "texto livre" }]);
    expect(parseMapElementAttributes(null)).toEqual([]);
  });
});


describe("map element focus zoom", () => {
  it("preserva zoom maior e aplica zoom mínimo quando necessário", async () => {
    const { getMapElementFocusZoom } = await import("../shared/map-element-data");
    expect(getMapElementFocusZoom(undefined, 10)).toBe(10);
    expect(getMapElementFocusZoom(6, 12)).toBe(12);
    expect(getMapElementFocusZoom(15, 12)).toBe(15);
  });
});
