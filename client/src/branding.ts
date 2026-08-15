export const ORBITA_LOGO_URL = "/manus-storage/orbita-logo-transparent-clean_79119bcb.png";
export const ORBITA_LOGO_DARK_URL = "/manus-storage/orbita-logo-white-transparent_b9c93a69.png";
export const ORBITA_NAME = "Órbita";
export const ORBITA_BRAND_NAME = "Órbita GIS & OS";
export const ORBITA_SUBTITLE = "GIS & OS";
export const SIDEBAR_LOGO_TARGET = "/dashboard";
export const SIDEBAR_COLLAPSED_STORAGE_KEY = "orbita.sidebarCollapsed";

export function getOrbitaLogoUrl(theme: "light" | "dark"): string {
  return theme === "dark" ? ORBITA_LOGO_DARK_URL : ORBITA_LOGO_URL;
}
