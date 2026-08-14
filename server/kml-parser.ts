export type KmlParsedElement = {
  name: string;
  description?: string;
  attributes?: Record<string, string>;
  geometryType: "LineString" | "Point" | "MultiLineString";
  coordinates: any;
};

export function parseKmlRichFeatures(kml: string): { features: any[]; bounds: any; summary: { lines: number; points: number; withDescription: number } } {
  // Parser robusto via regex/DOM para extrair Placemarks com nome, descrição e atributos
  const features: any[] = [];
  const allCoords: number[][] = [];

  // Extrair blocos <Placemark>...</Placemark>
  const placemarkRegex = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let match: RegExpExecArray | null;

  while ((match = placemarkRegex.exec(kml)) !== null) {
    const content = match[1];

    // Nome
    const nameMatch = /<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(content);
    const name = nameMatch ? nameMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "Elemento";

    // Descrição
    const descMatch = /<description\b[^>]*>([\s\S]*?)<\/description>/i.exec(content);
    const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : undefined;

    // Atributos ExtendedData / Data / SimpleData
    const attributes: Record<string, string> = {};
    const dataRegex = /<Data\b[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Data>/gi;
    let dataMatch: RegExpExecArray | null;
    while ((dataMatch = dataRegex.exec(content)) !== null) {
      const key = dataMatch[1];
      const valMatch = /<value\b[^>]*>([\s\S]*?)<\/value>/i.exec(dataMatch[2]);
      if (valMatch) {
        attributes[key] = valMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      }
    }

    // Coordenadas e Geometria (LineString ou Point)
    const lineMatch = /<LineString\b[^>]*>([\s\S]*?)<\/LineString>/i.exec(content);
    if (lineMatch) {
      const coordMatch = /<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i.exec(lineMatch[1]);
      if (coordMatch) {
        const rawCoords = coordMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
        const coords: number[][] = [];
        rawCoords.split(/\s+/).forEach((pair) => {
          const parts = pair.split(",").map(Number);
          if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            coords.push([parts[0], parts[1]]);
            allCoords.push([parts[0], parts[1]]);
          }
        });
        if (coords.length >= 2) {
          features.push({
            type: "Feature",
            properties: { name, description, attributes },
            geometry: { type: "LineString", coordinates: coords },
          });
        }
      }
    }

    const pointMatch = /<Point\b[^>]*>([\s\S]*?)<\/Point>/i.exec(content);
    if (pointMatch) {
      const coordMatch = /<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i.exec(pointMatch[1]);
      if (coordMatch) {
        const rawCoords = coordMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
        const parts = rawCoords.split(",").map(Number);
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          allCoords.push([parts[0], parts[1]]);
          features.push({
            type: "Feature",
            properties: { name, description, attributes },
            geometry: { type: "Point", coordinates: [parts[0], parts[1]] },
          });
        }
      }
    }
  }

  // Fallback se nenhum placemark for encontrado com tags padrão
  if (features.length === 0) {
    throw new Error("Nenhum elemento geográfico válido foi encontrado no arquivo KML/KMZ.");
  }

  const lngs = allCoords.map(([lng]) => lng);
  const lats = allCoords.map(([, lat]) => lat);
  const bounds = lngs.length > 0 ? {
    minLng: Math.min(...lngs),
    minLat: Math.min(...lats),
    maxLng: Math.max(...lngs),
    maxLat: Math.max(...lats),
  } : null;

  const lines = features.filter((f) => f.geometry.type === "LineString").length;
  const points = features.filter((f) => f.geometry.type === "Point").length;
  const withDescription = features.filter((f) => f.properties.description || Object.keys(f.properties.attributes).length > 0).length;

  return {
    features,
    bounds,
    summary: { lines, points, withDescription },
  };
}
