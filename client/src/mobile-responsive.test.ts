import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appLayoutSource = readFileSync(new URL("./components/AppLayout.tsx", import.meta.url), "utf8");
const splitLayoutSource = readFileSync(new URL("./components/SplitLayout.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("./pages/Dashboard.tsx", import.meta.url), "utf8");

describe("experiência mobile do Orbita", () => {
  it("oferece navegação inferior acessível sem remover a barra desktop", () => {
    expect(appLayoutSource).toContain('lg:hidden" aria-label="Navegação principal mobile"');
    expect(appLayoutSource).toContain('aria-label="Abrir menu completo"');
    expect(appLayoutSource).toContain('className={`hidden lg:flex flex-col fixed');
    expect(appLayoutSource).toContain("pb-16 lg:pb-0");
  });

  it("permite alternar entre lista e conteúdo no SplitLayout mobile", () => {
    expect(splitLayoutSource).toContain('role="tablist" aria-label="Navegação do painel"');
    expect(splitLayoutSource).toContain('aria-controls="split-panel-left"');
    expect(splitLayoutSource).toContain('aria-controls="split-panel-right"');
    expect(splitLayoutSource).toContain("lg:flex-row");
    expect(splitLayoutSource).toContain("mobilePanel === \"left\"");
    expect(splitLayoutSource).toContain("mobilePanel === \"right\"");
  });

  it("empilha o Dashboard e reduz a densidade dos controles apenas em breakpoints pequenos", () => {
    expect(dashboardSource).toContain("grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-5");
    expect(dashboardSource).toContain("p-3 sm:space-y-6 sm:p-4 lg:p-6");
    expect(dashboardSource).toContain("hidden sm:inline");
    expect(dashboardSource).toContain("sm:hidden");
    expect(dashboardSource).toContain("grid-cols-1 gap-3 sm:grid-cols-3");
    expect(dashboardSource).toContain("grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4");
  });
});

// A alteração é deliberadamente responsiva: as classes `lg:` preservam a composição desktop.
// Os testes verificam o contrato estrutural sem semear dados de produção ou alterar autenticação.
