import { describe, expect, it } from "vitest";
import { formatAreaM2, getContractAreaM2, sumContractAreasM2 } from "./area";

describe("area helpers", () => {
  it("usa a área principal do contrato como m²", () => {
    expect(getContractAreaM2({ areaHa: 1250 })).toBe(1250);
    expect(formatAreaM2(1250)).toContain("m²");
  });

  it("usa dados técnicos por tipo quando a área principal está vazia", () => {
    expect(getContractAreaM2({ areaHa: null, techDataByType: JSON.stringify({ implementacao: { areaHa: 500 }, restauracao: { areaM2: 250 } }) })).toBe(750);
  });

  it("não duplica dados técnicos quando já existe total principal", () => {
    expect(sumContractAreasM2([
      { areaHa: 1000, techDataByType: JSON.stringify({ implementacao: { areaHa: 1000 } }) },
      { areaM2: 250 },
    ])).toBe(1250);
  });

  it("ignora valores inválidos ou negativos", () => {
    expect(sumContractAreasM2([{ areaHa: -10 }, { areaHa: "invalido" }, { areaHa: 10.5 }])).toBe(10.5);
  });
});
