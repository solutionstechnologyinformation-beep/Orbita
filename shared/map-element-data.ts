export type MapElementRecord = {
  key: string;
  segmentId: number;
  segmentName: string;
  crsId: number;
  crsName: string;
  geometryType: "LineString" | "MultiLineString" | "Point";
  elementName: string;
  description: string;
  attributes: string;
  coordinates: number[][];
  center: { lat: number; lng: number } | null;
  workType: string;
  extensionKm: number | null;
};

function flattenCoordinates(geometry: any): number[][] {
  if (!geometry) return [];
  if (geometry.type === "Point") return Array.isArray(geometry.coordinates) ? [geometry.coordinates] : [];
  if (geometry.type === "LineString") return Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  if (geometry.type === "MultiLineString") return Array.isArray(geometry.coordinates) ? geometry.coordinates.flat() : [];
  return [];
}

function centerFromCoordinates(coordinates: number[][]): { lat: number; lng: number } | null {
  const valid = coordinates.filter((coordinate) => Number.isFinite(Number(coordinate?.[0])) && Number.isFinite(Number(coordinate?.[1])));
  if (valid.length === 0) return null;
  const totals = valid.reduce((sum, [lng, lat]) => ({ lng: sum.lng + Number(lng), lat: sum.lat + Number(lat) }), { lng: 0, lat: 0 });
  return { lat: totals.lat / valid.length, lng: totals.lng / valid.length };
}

export function extractMapElementRecords(segments: Array<any>): MapElementRecord[] {
  const records: MapElementRecord[] = [];
  for (const segment of segments) {
    let collection: any;
    try { collection = JSON.parse(segment.geometryJson); } catch { continue; }
    const features = Array.isArray(collection?.features) ? collection.features : [];
    features.forEach((feature: any, featureIndex: number) => {
      const geometryType = feature?.geometry?.type;
      if (geometryType !== "Point" && geometryType !== "LineString" && geometryType !== "MultiLineString") return;
      const coordinates = flattenCoordinates(feature.geometry);
      const center = centerFromCoordinates(coordinates);
      records.push({
        key: `${segment.id}:${featureIndex}`,
        segmentId: Number(segment.id),
        segmentName: String(segment.name ?? ""),
        crsId: Number(segment.crsId),
        crsName: String(segment.crsName ?? `Contrato #${segment.crsId}`),
        geometryType,
        elementName: String(feature?.properties?.name ?? segment.name ?? `Elemento ${featureIndex + 1}`),
        description: String(feature?.properties?.description ?? ""),
        attributes: Object.keys(feature?.properties?.attributes ?? {}).length > 0 ? JSON.stringify(feature.properties.attributes) : "",
        coordinates,
        center,
        workType: String(segment.tipoObra ?? ""),
        extensionKm: typeof segment.extensaoKm === "number" && Number.isFinite(segment.extensaoKm) ? segment.extensaoKm : null,
      });
    });
  }
  return records;
}

export function findMapElementRecord(records: MapElementRecord[], key: string | null): MapElementRecord | null {
  if (!key) return null;
  return records.find((record) => record.key === key) ?? null;
}

export function filterMapElementRecords(records: MapElementRecord[], query: string, limit = 30): MapElementRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedQuery) return records.slice(0, limit);
  return records.filter((record) => [
    record.elementName,
    record.description,
    record.attributes,
    record.crsName,
    record.segmentName,
    record.geometryType,
    record.workType,
  ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery))).slice(0, limit);
}

export function escapeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildMapElementsCsv(records: MapElementRecord[]): string {
  const header = ["Elemento", "Tipo de geometria", "Contrato", "OS/arquivo", "Descrição", "Atributos", "Latitude central", "Longitude central", "Extensão (km)"];
  const rows = records.map((record) => [
    record.elementName,
    record.geometryType === "Point" ? "Ponto" : "Trecho linear",
    record.crsName,
    record.segmentName,
    record.description,
    record.attributes,
    record.center?.lat ?? "",
    record.center?.lng ?? "",
    record.extensionKm ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
