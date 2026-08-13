import { describe, expect, it } from "vitest";
import { getSegmentExtensionKmValue } from "./segment-display";

describe("segment display metadata", () => {
  it("uses the legacy extension when it is available", () => {
    expect(getSegmentExtensionKmValue(42.5, '{"implementacao":{"extensaoKm":99}}')).toBe(42.5);
  });

  it("falls back to the sum of technical extensions by type", () => {
    expect(getSegmentExtensionKmValue(null, '{"implementacao":{"extensaoKm":12.5},"restauracao":{"extensaoKm":7.5}}')).toBe(20);
  });

  it("returns null when no valid extension is available", () => {
    expect(getSegmentExtensionKmValue(null, "{}" )).toBeNull();
    expect(getSegmentExtensionKmValue(null, "invalid-json" )).toBeNull();
  });
});
