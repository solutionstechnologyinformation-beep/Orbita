export type SegmentGeometry = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "LineString" | "MultiLineString";
      coordinates: number[][] | number[][][];
    };
  }>;
};

export function validateSegmentGeometry(raw: string): SegmentGeometry {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Geometria inválida.");
  }
  if (!parsed || typeof parsed !== "object" || (parsed as { type?: string }).type !== "FeatureCollection") {
    throw new Error("A geometria deve ser um FeatureCollection.");
  }
  const features = (parsed as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) throw new Error("Nenhum trecho foi encontrado.");

  const normalizedFeatures = features.filter((feature): feature is SegmentGeometry["features"][number] => {
    if (!feature || typeof feature !== "object") return false;
    const geometry = (feature as { geometry?: unknown }).geometry;
    if (!geometry || typeof geometry !== "object") return false;
    const geometryType = (geometry as { type?: string }).type;
    if (geometryType !== "LineString" && geometryType !== "MultiLineString") return false;
    const coordinates = (geometry as { coordinates?: unknown }).coordinates;
    return Array.isArray(coordinates) && coordinates.length > 1;
  });
  if (normalizedFeatures.length === 0) throw new Error("Nenhum trecho linear foi encontrado.");
  return { type: "FeatureCollection", features: normalizedFeatures };
}

export function getSegmentContentType(fileName: string): "application/vnd.google-earth.kmz" | "application/vnd.google-earth.kml+xml" {
  return fileName.toLowerCase().endsWith(".kmz") ? "application/vnd.google-earth.kmz" : "application/vnd.google-earth.kml+xml";
}

export function sanitizeSegmentFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-256) || "trecho.kmz";
}
