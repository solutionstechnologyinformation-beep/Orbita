import { describe, expect, it } from "vitest";
import { buildContractNumbers, filterVisibleSegments } from "./segment-map";

describe("segment map controls", () => {
  const segments = [
    { id: 10, crsId: 2, crsName: "BH Shopping" },
    { id: 11, crsId: 1, crsName: "BR-101" },
    { id: 12, crsId: 2, crsName: "BH Shopping" },
  ];

  it("creates stable numeric labels per contract in alphabetical order", () => {
    expect(buildContractNumbers(segments)).toEqual({ 1: 1, 2: 2 });
  });

  it("filters hidden segments and focuses the selected file", () => {
    expect(filterVisibleSegments(segments, { 10: true, 11: false, 12: true }, "all").map((segment) => segment.id)).toEqual([10, 12]);
    expect(filterVisibleSegments(segments, { 10: true, 11: false, 12: true }, 12).map((segment) => segment.id)).toEqual([12]);
  });
});
