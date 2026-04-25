/**
 * UserAvatar — componente reutilizável para exibir avatar de usuário.
 * Prioridade: avatarUrl (imagem) > avatarColor + avatarInitials > fallback gerado do nome.
 */

const PRESET_COLORS = [
  "#3b82f6", // azul
  "#f97316", // laranja
  "#10b981", // verde
  "#8b5cf6", // roxo
  "#ef4444", // vermelho
  "#06b6d4", // ciano
  "#f59e0b", // âmbar
  "#64748b", // cinza-azulado
  "#ec4899", // rosa
  "#14b8a6", // teal
];

function getInitialsFromName(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  user: {
    name?: string | null;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    avatarInitials?: string | null;
  };
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  xs: { outer: "w-6 h-6", text: "text-[10px]" },
  sm: { outer: "w-8 h-8", text: "text-xs" },
  md: { outer: "w-9 h-9", text: "text-sm" },
  lg: { outer: "w-11 h-11", text: "text-base" },
};

export function UserAvatar({ user, size = "md", className = "" }: UserAvatarProps) {
  const { outer, text } = SIZE_MAP[size];
  const initials = user.avatarInitials || getInitialsFromName(user.name);
  const bgColor = user.avatarColor || "#3b82f6";

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name ?? "avatar"}
        className={`${outer} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${outer} rounded-full flex items-center justify-center font-semibold shrink-0 ${text} ${className}`}
      style={{ backgroundColor: bgColor, color: "#fff" }}
    >
      {initials}
    </div>
  );
}

// ── Avatar Editor ────────────────────────────────────────────────────────────
interface AvatarEditorProps {
  value: { avatarColor: string; avatarInitials: string };
  onChange: (v: { avatarColor: string; avatarInitials: string }) => void;
  name?: string | null;
}

export function AvatarEditor({ value, onChange, name }: AvatarEditorProps) {
  const previewInitials = value.avatarInitials || getInitialsFromName(name);

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: value.avatarColor }}
        >
          {previewInitials}
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Pré-visualização</p>
          <p>Cor e iniciais do avatar</p>
        </div>
      </div>

      {/* Initials input */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Abreviação (até 3 letras)
        </label>
        <input
          type="text"
          maxLength={3}
          value={value.avatarInitials}
          onChange={(e) => onChange({ ...value, avatarInitials: e.target.value.toUpperCase() })}
          placeholder={getInitialsFromName(name)}
          className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
        />
        <p className="text-xs text-muted-foreground mt-1">Deixe em branco para usar as iniciais do nome</p>
      </div>

      {/* Color palette */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-2">
          Cor de fundo
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, avatarColor: color })}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: color,
                boxShadow: value.avatarColor === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : undefined,
              }}
              title={color}
            />
          ))}
          {/* Custom color picker */}
          <label
            className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
            title="Cor personalizada"
          >
            <span className="text-xs text-muted-foreground">+</span>
            <input
              type="color"
              value={value.avatarColor}
              onChange={(e) => onChange({ ...value, avatarColor: e.target.value })}
              className="sr-only"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export { PRESET_COLORS, getInitialsFromName };
