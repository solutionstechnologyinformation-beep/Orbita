import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const ganttSource = readFileSync(new URL("./pages/Gantt.tsx", import.meta.url), "utf8");
const projectsSource = readFileSync(new URL("./pages/Projects.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("./pages/Home.tsx", import.meta.url), "utf8");
const plansSource = readFileSync(new URL("./pages/Plans.tsx", import.meta.url), "utf8");

describe("dark theme surfaces across application tabs", () => {
  it("maps legacy light surfaces and muted text to semantic dark tokens", () => {
    expect(stylesheet).toContain(".dark .bg-white");
    expect(stylesheet).toContain(".dark .bg-slate-50");
    expect(stylesheet).toContain(".dark .bg-gray-100");
    expect(stylesheet).toContain("background-color: color-mix(in srgb, var(--brand-accent) 16%, var(--card)) !important;");
    expect(stylesheet).toContain(".dark .text-slate-900");
    expect(stylesheet).toContain(".dark .border-slate-200");
  });

  it("covers the Gantt root and its arbitrary light timeline surfaces", () => {
    expect(ganttSource).toContain("gantt-page h-full min-h-0 bg-background text-foreground");
    expect(stylesheet).toContain('[class*="bg-[#f6f8fb]"]');
    expect(stylesheet).toContain('[class*="bg-[#f8fafc]"]');
    expect(stylesheet).toContain('[class*="bg-[#eef5ff]"]');
  });

  it("does not force white inline backgrounds in the Projects filters", () => {
    expect(projectsSource).toContain("bg-background");
    expect(projectsSource).not.toContain("style={{backgroundColor: '#dedede'}}");
    expect(projectsSource).not.toContain("style={{backgroundColor: '#ffffff'}}");
  });

  it("uses semantic surfaces on the public Home and Plans screens", () => {
    expect(homeSource).toContain("min-h-screen bg-background");
    expect(homeSource).toContain("bg-card rounded-2xl");
    expect(homeSource).not.toContain('className="min-h-screen bg-white text-foreground"');
    expect(plansSource).toContain("min-h-screen bg-background");
    expect(plansSource).toContain("bg-background/95");
    expect(plansSource).not.toContain('className="min-h-screen bg-white text-foreground"');
  });
});
