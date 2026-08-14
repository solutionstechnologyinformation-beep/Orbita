import { describe, expect, it } from "vitest";
import { ORBITA_BRAND_NAME, ORBITA_LOGO_DARK_URL, ORBITA_LOGO_URL, SIDEBAR_LOGO_TARGET, SIDEBAR_COLLAPSED_STORAGE_KEY, getOrbitaLogoUrl } from "../client/src/branding";

describe("Orbita branding asset", () => {
  it("uses the transparent PNG storage asset consistently", () => {
    expect(ORBITA_LOGO_URL).toMatch(/^\/manus-storage\/orbita-logo-transparent-clean_[a-z0-9]+\.png$/);
    expect(ORBITA_BRAND_NAME).toBe("Órbita GIS & OS");
    expect(ORBITA_LOGO_DARK_URL).toMatch(/^\/manus-storage\/orbita-logo-dark-white_[a-z0-9]+\.png$/);
    expect(getOrbitaLogoUrl("light")).toBe(ORBITA_LOGO_URL);
    expect(getOrbitaLogoUrl("dark")).toBe(ORBITA_LOGO_DARK_URL);
    expect(SIDEBAR_LOGO_TARGET).toBe("/dashboard");
    expect(SIDEBAR_COLLAPSED_STORAGE_KEY).toBe("orbita.sidebarCollapsed");
  });
});
