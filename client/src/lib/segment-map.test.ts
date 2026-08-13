import { describe, expect, it } from "vitest";
import { buildContractNumbers, clusterMapPoints, filterVisibleSegments } from "./segment-map";

describe("segment map controls", () => {
  const segments = [
    { id: 10, crsId: 2, crsName: "BH Shopping" },
    { id: 11, crsId: 1, crsName: "BR-101" },
    { id: 12, crsId: 2, crsName: "BH Shopping" },
  ];

  it("creates stable numeric labels per contract in alphabetical order", () => {
    expect(buildContractNumbers(segments)).toEqual({ 1: 2, 2: 1 });
  });

  it("filters hidden segments and focuses the selected file", () => {
    expect(filterVisibleSegments(segments, { 10: true, 11: false, 12: true }, "all").map((segment) => segment.id)).toEqual([10, 12]);
    expect(filterVisibleSegments(segments, { 10: true, 11: false, 12: true }, 12).map((segment) => segment.id)).toEqual([12]);
  });

  it("groups nearby points at low zoom and separates them at high zoom", () => {
    const points = [
      { item: { id: 1 }, position: { lat: -19.92, lng: -43.94 } },
      { item: { id: 2 }, position: { lat: -19.93, lng: -43.95 } },
      { item: { id: 3 }, position: { lat: -23.55, lng: -46.63 } },
    ];

    const lowZoom = clusterMapPoints(points, 5);
    const highZoom = clusterMapPoints(points, 12);

    expect(lowZoom).toHaveLength(2);
    expect(lowZoom.find((cluster) => cluster.points.length === 2)?.center.lat).toBeCloseTo(-19.925, 3);
    expect(highZoom).toHaveLength(3);
    expect(highZoom.every((cluster) => cluster.points.length === 1)).toBe(true);
  });

  it("returns all points without dropping items while clustering", () => {
    const points = Array.from({ length: 5 }, (_, index) => ({
      item: { id: index + 1 },
      position: { lat: -10 - index * 10, lng: -40 - index * 10 },
    }));

    const clusters = clusterMapPoints(points, 4);
    expect(clusters.flatMap((cluster) => cluster.points).map((point) => point.item.id).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
