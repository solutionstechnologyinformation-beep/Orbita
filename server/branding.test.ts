import { describe, expect, it } from "vitest";
import { LS_SOLUTIONS_NAME, ORBITA_BRAND_NAME, ORBITA_LOGO_URL } from "../client/src/branding";

describe("Orbita branding asset", () => {
  it("uses the transparent PNG storage asset consistently", () => {
    expect(ORBITA_LOGO_URL).toMatch(/^\/manus-storage\/orbita-logo-transparent-clean_[a-z0-9]+\.png$/);
    expect(ORBITA_BRAND_NAME).toBe("Orbita GIS & OS");
    expect(LS_SOLUTIONS_NAME).toBe("LS Solutions");
  });
});
