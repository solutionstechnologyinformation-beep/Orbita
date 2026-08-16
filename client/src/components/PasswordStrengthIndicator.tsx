import { CheckCircle2, ShieldAlert } from "lucide-react";
import { getPasswordStrength, type ClientPasswordPolicy } from "@/lib/password-strength";

type PasswordStrengthIndicatorProps = {
  password: string;
  policy?: Partial<ClientPasswordPolicy>;
  compact?: boolean;
};

export function PasswordStrengthIndicator({ password, policy, compact = false }: PasswordStrengthIndicatorProps) {
  const strength = getPasswordStrength(password, policy);
  const colors = ["bg-rose-500", "bg-orange-500", "bg-amber-400", "bg-emerald-500"];
  const activeBars = password ? Math.max(1, Math.ceil((strength.score / 4) * 4)) : 0;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"} aria-live="polite">
      <div className="flex items-center gap-1" role="progressbar" aria-label={`Força da senha: ${strength.label}`} aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score}>
        {colors.map((color, index) => (
          <span key={color} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${index < activeBars ? color : "bg-slate-200 dark:bg-slate-700"}`} aria-hidden="true" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={password ? (strength.isCompliant ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-amber-700 dark:text-amber-400") : "text-slate-500"}>
          {strength.label}
        </span>
        {password && strength.isCompliant ? (
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Atende à política</span>
        ) : password && strength.missingRequirements.length > 0 ? (
          <span className="flex items-center gap-1 text-slate-500"><ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Ainda não atende</span>
        ) : null}
      </div>
      {!compact && password && strength.missingRequirements.length > 0 && (
        <p className="text-[11px] leading-4 text-slate-500">{strength.missingRequirements.join(" ")}</p>
      )}
    </div>
  );
}
