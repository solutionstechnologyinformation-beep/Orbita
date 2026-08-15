import { describe, expect, it } from "vitest";
import { getSoundWaveLabel } from "./SoundWaveIndicator";

describe("SoundWaveIndicator", () => {
  it("describes listening and speaking states accessibly", () => {
    expect(getSoundWaveLabel("listening")).toBe("Assistente ouvindo");
    expect(getSoundWaveLabel("speaking")).toBe("Assistente falando");
  });

  it("keeps calm labels for paused, idle and error states", () => {
    expect(getSoundWaveLabel("paused")).toContain("pausada");
    expect(getSoundWaveLabel("idle")).toContain("espera");
    expect(getSoundWaveLabel("error")).toContain("indisponível");
  });
});
