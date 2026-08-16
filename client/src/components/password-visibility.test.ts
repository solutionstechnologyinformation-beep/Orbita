import { describe, expect, it } from "vitest";
import { getPasswordVisibilityLabel } from "./PasswordVisibilityToggle";

describe("password-visibility", () => {
  it("começa com ação para exibir a senha", () => {
    expect(getPasswordVisibilityLabel(false)).toBe("Exibir senha");
  });

  it("troca o rótulo para ocultar quando a senha está visível", () => {
    expect(getPasswordVisibilityLabel(true)).toBe("Ocultar senha");
  });
});
