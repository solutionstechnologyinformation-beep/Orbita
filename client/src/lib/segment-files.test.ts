import { describe, expect, it } from "vitest";
import { getSegmentBaseName, isSupportedSegmentFileName } from "./segment-files";

describe("segment file helpers", () => {
  it("accepts KMZ and KML names case-insensitively", () => {
    expect(isSupportedSegmentFileName("BHShopping.kmz")).toBe(true);
    expect(isSupportedSegmentFileName("trecho.KML")).toBe(true);
  });

  it("rejects unsupported file extensions", () => {
    expect(isSupportedSegmentFileName("BHShopping.zip")).toBe(false);
    expect(isSupportedSegmentFileName("BHShopping.kmz.pdf")).toBe(false);
  });

  it("extracts the display name without the KMZ/KML extension", () => {
    expect(getSegmentBaseName("BHShopping.kmz")).toBe("BHShopping");
    expect(getSegmentBaseName("  trecho-principal.KML  ")).toBe("trecho-principal");
  });
});
