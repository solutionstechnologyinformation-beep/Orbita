import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const getPasswordVisibilityLabel = (visible: boolean) => visible ? "Ocultar senha" : "Exibir senha";


type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
  inputId: string;
};

export function PasswordVisibilityToggle({ visible, onToggle, inputId }: PasswordVisibilityToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={getPasswordVisibilityLabel(visible)}
      aria-pressed={visible}
      aria-controls={inputId}
      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
