import { describe, expect, it } from "vitest";
import { requiresMandatoryTfaForInvite, shouldBlockWorkspaceAccess } from "./mandatory-tfa";

describe("company-invite-mandatory-2fa", () => {
  it("marca convite com papel de administrador da empresa para setup obrigatório", () => {
    expect(requiresMandatoryTfaForInvite("company_admin")).toBe(true);
  });

  it("não força setup para convites de usuário ou líder", () => {
    expect(requiresMandatoryTfaForInvite("user")).toBe(false);
    expect(requiresMandatoryTfaForInvite("leader")).toBe(false);
  });

  it("bloqueia o workspace enquanto o marcador persistente estiver ativo", () => {
    expect(shouldBlockWorkspaceAccess({ tfaSetupRequired: true })).toBe(true);
    expect(shouldBlockWorkspaceAccess({ tfaSetupRequired: false })).toBe(false);
    expect(shouldBlockWorkspaceAccess({ tfaSetupRequired: null })).toBe(false);
  });

  it("libera o workspace depois que o endpoint de confirmação desativa o marcador", () => {
    const userAfterSetup = {
      tfaSetupRequired: false,
      tfaEnabled: true,
    };
    expect(shouldBlockWorkspaceAccess(userAfterSetup)).toBe(false);
  });
});
