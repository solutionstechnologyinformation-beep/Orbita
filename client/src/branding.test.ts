import { describe, expect, it } from "vitest";
import {
  ORBITA_BRAND_NAME,
  ORBITA_LOGO_DARK_URL,
  ORBITA_LOGO_URL,
  ORBITA_NAME,
  getOrbitaLogoUrl,
} from "./branding";

describe("Orbita branding", () => {
  it("uses the current Orbita logo in light mode", () => {
    expect(getOrbitaLogoUrl("light")).toBe(ORBITA_LOGO_URL);
    expect(ORBITA_LOGO_URL).toContain("orbita-logo-transparent-clean");
  });

  it("uses the white current Orbita logo in dark mode", () => {
    expect(getOrbitaLogoUrl("dark")).toBe(ORBITA_LOGO_DARK_URL);
    expect(ORBITA_LOGO_DARK_URL).toContain("orbita-logo-white-transparent");
    expect(ORBITA_LOGO_DARK_URL).toMatch(/\.png$/);
    expect(ORBITA_LOGO_DARK_URL).not.toContain("ls-logo");
  });

  it("exposes the Orbita name consistently", () => {
    expect(ORBITA_NAME).toBe("Órbita");
    expect(ORBITA_BRAND_NAME).toBe("Órbita GIS & OS");
  });
});
