import { describe, expect, it } from "vitest";
import { normalizeCompanySlug } from "./admin-company-utils";

describe("admin company helpers", () => {
  it("normalizes names into stable slugs", () => {
    expect(normalizeCompanySlug(" LS Solutions Brasil ")).toBe("ls-solutions-brasil");
    expect(normalizeCompanySlug("Engenharia & Obras")) .toBe("engenharia-obras");
    expect(normalizeCompanySlug("---")) .toBe("");
  });
});
