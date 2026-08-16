import { describe, expect, it } from "vitest";
import { GUIDED_TOUR_STEPS, getGuidedTourTransitionClass } from "./GuidedTourModal";

describe("GuidedTourModal", () => {
  it("cobre as áreas principais do Órbita em uma ordem navegável", () => {
    const hrefs = GUIDED_TOUR_STEPS.map((step) => step.href);
    const ids = GUIDED_TOUR_STEPS.map((step) => step.id);

    expect(GUIDED_TOUR_STEPS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(hrefs[0]).toBe("/dashboard");
    expect(hrefs).toContain("/kanban");
    expect(hrefs).toContain("/gantt");
    expect(hrefs).toContain("/relatorios");
    expect(hrefs).toContain("/chat");
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/migration");
    expect(hrefs[hrefs.length - 1]).toBe("/manual");
  });

  it("mantém textos comerciais e três pontos de orientação por etapa", () => {
    for (const step of GUIDED_TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(5);
      expect(step.eyebrow.length).toBeGreaterThan(3);
      expect(step.description.length).toBeGreaterThan(40);
      expect(step.bullets).toHaveLength(3);
      expect(step.bullets.every((bullet) => bullet.length > 2)).toBe(true);
      expect(step.icon).toBeDefined();
    }
  });

  it("gera classes direcionais distintas para avançar, voltar e estado estável", () => {
    expect(getGuidedTourTransitionClass("idle", "forward")).toBe("");
    expect(getGuidedTourTransitionClass("exit", "forward")).toBe("guided-tour-step-exit-forward");
    expect(getGuidedTourTransitionClass("enter", "forward")).toBe("guided-tour-step-enter-forward");
    expect(getGuidedTourTransitionClass("exit", "backward")).toBe("guided-tour-step-exit-backward");
    expect(getGuidedTourTransitionClass("enter", "backward")).toBe("guided-tour-step-enter-backward");
  });

  it("inclui os blocos comerciais de segurança, colaboração e continuidade", () => {
    const content = GUIDED_TOUR_STEPS.map((step) => `${step.title} ${step.description} ${step.bullets.join(" ")}`).join(" ").toLowerCase();

    expect(content).toContain("2fa");
    expect(content).toContain("multi-tenant");
    expect(content).toContain("backup");
    expect(content).toContain("relat");
    expect(content).toContain("taref");
    expect(content).toContain("ia");
  });
});
