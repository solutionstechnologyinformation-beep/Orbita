export type ClientPasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
};

export const DEFAULT_CLIENT_PASSWORD_POLICY: ClientPasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireNumber: true,
  requireSpecial: false,
};

export type PasswordStrength = {
  score: number;
  label: "Digite sua senha" | "Muito fraca" | "Fraca" | "Média" | "Forte" | "Muito forte";
  isCompliant: boolean;
  missingRequirements: string[];
};

export function getPasswordStrength(password: string, policy: Partial<ClientPasswordPolicy> = {}): PasswordStrength {
  const currentPolicy = { ...DEFAULT_CLIENT_PASSWORD_POLICY, ...policy };
  if (!password) {
    return { score: 0, label: "Digite sua senha", isCompliant: false, missingRequirements: [] };
  }

  const checks = [
    password.length >= currentPolicy.minLength,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9\s]/.test(password),
  ];
  const missingRequirements: string[] = [];
  if (!checks[0]) missingRequirements.push(`Use pelo menos ${currentPolicy.minLength} caracteres.`);
  if (currentPolicy.requireUppercase && !checks[1]) missingRequirements.push("Inclua uma letra maiúscula.");
  if (currentPolicy.requireNumber && !checks[2]) missingRequirements.push("Inclua um número.");
  if (currentPolicy.requireSpecial && !checks[3]) missingRequirements.push("Inclua um caractere especial.");

  const score = checks.filter(Boolean).length;
  const labels: PasswordStrength["label"][] = ["Muito fraca", "Muito fraca", "Fraca", "Forte", "Muito forte"];
  return {
    score,
    label: labels[score],
    isCompliant: missingRequirements.length === 0,
    missingRequirements,
  };
}
