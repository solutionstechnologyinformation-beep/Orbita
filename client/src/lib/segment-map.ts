export type SegmentMapItem = {
  id: number;
  crsId: number;
  crsName?: string | null;
};

export type MapPoint<T> = {
  item: T;
  position: { lat: number; lng: number };
};

export type MapCluster<T> = {
  center: { lat: number; lng: number };
  points: MapPoint<T>[];
};

export function buildContractNumbers(segments: SegmentMapItem[]): Record<number, number> {
  const contracts = Array.from(new Map(segments.map((segment) => [segment.crsId, segment.crsName ?? `Contrato #${segment.crsId}`])).entries())
    .sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"));
  return Object.fromEntries(contracts.map(([crsId], index) => [crsId, index + 1]));
}

export function filterVisibleSegments<T extends SegmentMapItem>(
  segments: T[],
  visibility: Record<number, boolean>,
  selectedSegmentId: number | "all",
): T[] {
  return segments.filter((segment) => visibility[segment.id] !== false && (selectedSegmentId === "all" || segment.id === selectedSegmentId));
}

/**
 * Agrupa pontos próximos usando uma distância aproximada em graus que diminui
 * conforme o zoom aumenta. A longitude é ajustada pela latitude para manter
 * o agrupamento visual coerente em diferentes regiões do mapa.
 */
export function clusterMapPoints<T>(points: MapPoint<T>[], zoom: number): MapCluster<T>[] {
  const safeZoom = Number.isFinite(zoom) ? Math.max(0, zoom) : 0;
  const radius = 40 / (2 ** safeZoom);
  const remaining = [...points];
  const clusters: MapCluster<T>[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members = [seed];
    let centerLat = seed.position.lat;
    let centerLng = seed.position.lng;

    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      const latitude = (centerLat + candidate.position.lat) / 2;
      const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
      const distance = Math.hypot(
        candidate.position.lat - centerLat,
        (candidate.position.lng - centerLng) * longitudeScale,
      );

      if (distance <= radius) {
        members.push(candidate);
        remaining.splice(index, 1);
        centerLat = members.reduce((sum, point) => sum + point.position.lat, 0) / members.length;
        centerLng = members.reduce((sum, point) => sum + point.position.lng, 0) / members.length;
      }
    }

    clusters.push({
      center: { lat: centerLat, lng: centerLng },
      points: members,
    });
  }

  return clusters;
}
