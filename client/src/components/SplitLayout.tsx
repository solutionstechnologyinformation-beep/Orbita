import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SplitLayoutProps {
  /** Painel esquerdo (lista/navegação) */
  left: ReactNode;
  /** Painel direito (detalhe/conteúdo principal) */
  right: ReactNode;
  /** Largura do painel esquerdo (padrão: 320px) */
  leftWidth?: string;
  /** Classe extra para o container raiz */
  className?: string;
  /** Classe extra para o painel esquerdo */
  leftClassName?: string;
  /** Classe extra para o painel direito */
  rightClassName?: string;
  /** Se true, mostra apenas o painel direito em mobile */
  mobileShowRight?: boolean;
}

/**
 * SplitLayout — Layout 3 (Split Panel)
 *
 * Painel esquerdo fixo com lista/navegação + painel direito com conteúdo.
 * Ambos os painéis têm scroll independente.
 */
export function SplitLayout({
  left,
  right,
  leftWidth = "320px",
  className,
  leftClassName,
  rightClassName,
  mobileShowRight = false,
}: SplitLayoutProps) {
  return (
    <div
      className={cn("flex h-full overflow-hidden", className)}
      style={{ minHeight: 0 }}
    >
      {/* Left Panel */}
      <div
        className={cn(
          "flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-card",
          mobileShowRight ? "hidden lg:flex" : "flex",
          leftClassName
        )}
        style={{ width: leftWidth, minWidth: 0 }}
      >
        {left}
      </div>

      {/* Right Panel */}
      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden bg-background",
          mobileShowRight ? "flex" : "hidden lg:flex",
          rightClassName
        )}
        style={{ minWidth: 0 }}
      >
        {right}
      </div>
    </div>
  );
}

/** Cabeçalho padronizado para o painel esquerdo */
export function SplitPanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-shrink-0 px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-2",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/** Área de conteúdo com scroll para o painel esquerdo */
export function SplitPanelList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>{children}</div>
  );
}

/** Item de lista clicável para o painel esquerdo */
export function SplitPanelItem({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 cursor-pointer transition-colors border-b border-border/50 last:border-0",
        active
          ? "bg-primary/10 border-l-2 border-l-primary"
          : "hover:bg-muted/50 border-l-2 border-l-transparent",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Área de conteúdo do painel direito com padding e scroll */
export function SplitPanelContent({
  children,
  className,
  noPadding = false,
}: {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto",
        !noPadding && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Estado vazio para o painel direito */
export function SplitPanelEmpty({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
