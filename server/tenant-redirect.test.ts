import { describe, expect, it } from "vitest";
import { normalizeHost } from "./tenant-resolver";

describe("Redirecionamento de domínios secundários e SSL", () => {
  it("normaliza corretamente o host para verificação de tenant", () => {
    expect(normalizeHost("SECUNDARIO.com.br:443")).toBe("secundario.com.br");
    expect(normalizeHost("primario.com.br.")).toBe("primario.com.br");
  });
});
