import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const componentPath = path.resolve(process.cwd(), "client/src/components/BrandingDashboardPreview.tsx");
const companyAdminPath = path.resolve(process.cwd(), "client/src/pages/CompanyAdmin.tsx");

describe("Pré-visualização de branding", () => {
  const component = fs.readFileSync(componentPath, "utf8");
  const companyAdmin = fs.readFileSync(companyAdminPath, "utf8");

  it("exibe a identidade temporária com alternância de tema acessível", () => {
    expect(component).toContain("Como o dashboard ficará");
    expect(component).toContain('aria-label="Tema da pré-visualização"');
    expect(component).toContain('aria-pressed={theme === "light"}');
    expect(component).toContain('aria-pressed={theme === "dark"}');
    expect(component).toContain("values.logoDarkUrl || values.logoUrl");
  });

  it("renderiza a cor escolhida nos elementos do dashboard simulado", () => {
    expect(component).toContain("values.color");
    expect(component).toContain("conic-gradient");
    expect(component).toContain("Progresso dos OKRs");
    expect(component).toContain("Saúde da operação");
  });

  it("mantém upload e reset locais até a confirmação do branding", () => {
    expect(companyAdmin).toContain("setPendingLogos");
    expect(component).toContain("Restaurar valores salvos");
    expect(companyAdmin).toContain("updateBranding.mutateAsync");
    expect(companyAdmin).toContain("color: brandingForm.color");
  });
});
