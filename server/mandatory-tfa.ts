export const MANDATORY_TFA_INVITE_ROLE = "company_admin" as const;

export function requiresMandatoryTfaForInvite(role: string) {
  return role === MANDATORY_TFA_INVITE_ROLE;
}

export function shouldBlockWorkspaceAccess(user: { tfaSetupRequired?: boolean | null }) {
  return user.tfaSetupRequired === true;
}
