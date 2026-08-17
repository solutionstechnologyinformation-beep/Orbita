import { describe, expect, it } from "vitest";
import { shouldProvisionCompanyForAdmin, slugifyCompanyNameForProvisioning } from "./db";

describe("company context resolution", () => {
  it("provisions a tenant only for a legacy admin when no tenant exists", () => {
    expect(shouldProvisionCompanyForAdmin("admin", 0)).toBe(true);
    expect(shouldProvisionCompanyForAdmin("company_admin", 0)).toBe(false);
    expect(shouldProvisionCompanyForAdmin("master_admin", 0)).toBe(false);
  });

  it("does not guess a tenant when more than one company exists", () => {
    expect(shouldProvisionCompanyForAdmin("admin", 2)).toBe(false);
  });

  it("normalizes accented company names into safe slugs", () => {
    expect(slugifyCompanyNameForProvisioning("Órbita Engenharia & Obras")).toBe("orbita-engenharia-obras");
    expect(slugifyCompanyNameForProvisioning("!!!")).toBe("empresa-orbita");
  });
});
