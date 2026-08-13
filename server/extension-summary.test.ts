import { describe, expect, it } from "vitest";
import { aggregateExtensionByType } from "./extension-summary";

describe("aggregateExtensionByType", () => {
  it("uses detailed technical data as the source of truth", () => {
    const result = aggregateExtensionByType([
      {
        tipoObra: '["implementacao"]',
        extensaoKm: null,
        techDataByType: JSON.stringify({ implementacao: { extensaoKm: 10 }, restauracao: { extensaoKm: 4.5 } }),
      },
    ]);
    expect(result.totalExtensaoKm).toBe(14.5);
    expect(result.extensaoByTipo).toEqual({ implementacao: 10, restauracao: 4.5 });
  });

  it("falls back to the legacy total and splits it evenly across multiple types", () => {
    const result = aggregateExtensionByType([
      { tipoObra: '["implementacao","restauracao"]', extensaoKm: 20, techDataByType: null },
    ]);
    expect(result.totalExtensaoKm).toBe(20);
    expect(result.extensaoByTipo).toEqual({ implementacao: 10, restauracao: 10 });
  });

  it("classifies legacy rows without a type as outro", () => {
    const result = aggregateExtensionByType([{ tipoObra: null, extensaoKm: 7.25, techDataByType: null }]);
    expect(result.totalExtensaoKm).toBe(7.25);
    expect(result.extensaoByTipo).toEqual({ outro: 7.25 });
  });
});
