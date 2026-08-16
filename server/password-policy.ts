export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireNumber: true,
  requireSpecial: false,
};

export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
};

export function normalizePasswordPolicy(input: Partial<PasswordPolicy> | null | undefined): PasswordPolicy {
  return {
    minLength: Math.max(8, Math.min(128, Math.trunc(input?.minLength ?? DEFAULT_PASSWORD_POLICY.minLength))),
    requireUppercase: input?.requireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
    requireNumber: input?.requireNumber ?? DEFAULT_PASSWORD_POLICY.requireNumber,
    requireSpecial: input?.requireSpecial ?? DEFAULT_PASSWORD_POLICY.requireSpecial,
  };
}

export function validatePassword(password: string, input?: Partial<PasswordPolicy> | null): PasswordValidationResult {
  const policy = normalizePasswordPolicy(input);
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`A senha deve ter pelo menos ${policy.minLength} caracteres.`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("A senha deve conter pelo menos uma letra maiúscula.");
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    errors.push("A senha deve conter pelo menos um número.");
  }
  if (policy.requireSpecial && !/[^A-Za-z0-9\s]/.test(password)) {
    errors.push("A senha deve conter pelo menos um caractere especial.");
  }

  return { valid: errors.length === 0, errors };
}

export function passwordPolicyToClient(input: Partial<PasswordPolicy> | null | undefined): PasswordPolicy {
  return normalizePasswordPolicy(input);
}
