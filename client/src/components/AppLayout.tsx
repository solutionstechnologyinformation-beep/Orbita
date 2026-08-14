import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ORBITA_LOGO_URL, ORBITA_BRAND_NAME, LS_SOLUTIONS_NAME, SIDEBAR_LOGO_TARGET, SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/branding";
import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
  Video,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  FolderKanban,
  GanttChartSquare,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Shield,
  Building2,
  Target,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { UserAvatar } from "./UserAvatar";
import { FloatingAgent } from "./FloatingAgent";
import { useTheme } from "../contexts/ThemeContext";
import { getThemeToggleCopy } from "../contexts/theme-utils";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// ── Sidebar color tokens ──────────────────────────────────────────────────
const SIDEBAR_BG = "#0f172a";          // azul-marinho escuro
const SIDEBAR_TEXT = "#e2e8f0";        // cinza claro
const SIDEBAR_ACTIVE_BG = "#3b82f6";   // azul primário
const SIDEBAR_ACTIVE_TEXT = "#ffffff"; // branco
const SIDEBAR_HOVER_BG = "rgba(255,255,255,0.08)";
const SIDEBAR_SECTION_TEXT = "rgba(148,163,184,0.8)"; // slate-400

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projetos" },
  { href: "/kanban", icon: Kanban, label: "Kanban" },
  { href: "/gantt", icon: GanttChartSquare, label: "Gantt" },
  { href: "/sprints", icon: Target, label: "Sprints" },
  { href: "/scheduling", icon: CalendarRange, label: "Programação" },
  { href: "/calendar", icon: CalendarDays, label: "Calendário" },
  { href: "/reunioes", icon: Video, label: "Reuniões" },
  { href: "/relatorios", icon: FileBarChart, label: "Relatórios" },
  { href: "/team-chat", icon: MessageSquare, label: "Chat de Tarefas" },
  { href: "/whiteboard", icon: PenSquare, label: "Quadro Branco" },
  { href: "/notifications", icon: Bell, label: "Notificações" },
  { href: "/chat", icon: Bot, label: "Chat IA" },
];

const adminItems = [
  { href: "/admin", icon: Shield, label: "Admin" },
  { href: "/company-admin", icon: Building2, label: "Admin da empresa" },
];

const helpItems = [
  { href: "/manual", icon: BookOpen, label: "Manual de Uso" },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { isDark, label, ariaLabel } = getThemeToggleCopy(theme);

  if (!toggleTheme) return null;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  /** Se true, remove o padding do main e usa overflow-hidden para suportar SplitLayout */
  fullHeight?: boolean;
}

export default function AppLayout({ children, title, backHref, fullHeight }: AppLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });
  const [crsExpanded, setCrsExpanded] = useState(false);

  const { data: crsList = [] } = trpc.crs.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const { data: notifList = [] } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });
  const unreadCount = notifList.filter((n: any) => !n.isRead).length;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: SIDEBAR_BG }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  const SidebarContent = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex flex-col h-full" style={{ backgroundColor: isDark ? "#111827" : "#ffc30d" }}>
      {/* Logo / Brand */}
      <div
        className={`flex items-center px-3 py-4 ${compact ? "justify-center" : "gap-3"}`}
        style={{ borderBottom: `1px solid ${isDark ? "rgba(148,163,184,0.18)" : "rgba(0,0,0,0.1)"}`, backgroundColor: isDark ? "#111827" : "#ffc30d" }}
      >
        <button
          type="button"
          onClick={() => navigate(SIDEBAR_LOGO_TARGET)}
          aria-label="Voltar ao Dashboard"
          title="Voltar ao Dashboard"
          className="group flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg p-0.5 outline-none transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-105 hover:drop-shadow-[0_5px_12px_rgba(15,23,42,0.28)] focus-visible:ring-2 focus-visible:ring-black/60"
        >
          <img
            src={ORBITA_LOGO_URL}
            alt="Logo Orbita — voltar ao Dashboard"
            className="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:rotate-1"
          />
        </button>
        {!compact && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-black text-sm tracking-wide text-black uppercase">{LS_SOLUTIONS_NAME}</span>
            <span className="text-xs font-semibold text-black/70 truncate">{ORBITA_BRAND_NAME}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={compact ? "Expandir barra lateral" : "Recolher barra lateral"}
          title={compact ? "Expandir barra lateral" : "Recolher barra lateral"}
          className="hidden lg:inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-black/70 transition-colors hover:bg-black/10 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
        >
          {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${compact ? "px-2" : "px-3"}`} style={{ backgroundColor: isDark ? "#111827" : "#ffc30d" }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/dashboard" && href !== "/kanban" && location.startsWith(href));

          // Item especial: Projetos com submenu de Contrato
          if (href === "/projects") {
            return (
              <div key={href}>
                <div
                  className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${compact ? "justify-center px-2" : "px-3"} py-2.5`}
                  title={compact ? label : undefined}
                  style={{
                    color: active ? SIDEBAR_ACTIVE_TEXT : SIDEBAR_TEXT,
                    backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                  onClick={() => {
                    setSidebarOpen(false);
                    navigate("/projects");
                    setCrsExpanded(!crsExpanded);
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!compact && <span className="flex-1" style={{ color: isDark ? "#f8fafc" : "#000000" }}>{label}</span>}
                  {!compact && crsList.length > 0 && (
                    crsExpanded
                      ? <ChevronDown className="w-3 h-3 opacity-60" />
                      : <ChevronRight className="w-3 h-3 opacity-60" />
                  )}
                </div>
                {/* Submenu de Contrato */}
                {!compact && crsExpanded && crsList.length > 0 && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {(crsList as any[]).slice(0, 8).map((c: any) => {
                      const kanbanHref = `/kanban?crs=${c.id}`;
                      const crsActive = location === `/kanban` && window.location.search.includes(`crs=${c.id}`);
                      return (
                        <Link
                          key={c.id}
                          href={kanbanHref}
                          onClick={() => setSidebarOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 w-full"
                          style={{
                            color: crsActive ? "#3b82f6" : "rgba(148,163,184,0.9)",
                            backgroundColor: crsActive ? "rgba(59,130,246,0.15)" : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = crsActive ? "rgba(59,130,246,0.15)" : "transparent";
                          }}
                        >
                          <Kanban className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{c.code ? `${c.code} — ` : ""}{c.name}</span>
                        </Link>
                      );
                    })}
                    {crsList.length > 8 && (
                      <Link
                        href="/projects"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-150 w-full"
                        style={{ color: "rgba(148,163,184,0.5)" }}
                      >
                        +{crsList.length - 8} mais...
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 w-full ${compact ? "justify-center px-2" : "px-3"} py-2.5`}
              title={compact ? label : undefined}
              style={{
                color: '#000000',
                backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!compact && <span className="flex-1" style={{ color: isDark ? "#f8fafc" : "#000000" }}>{label}</span>}
              {!compact && label === "Notificações" && unreadCount > 0 && (
                <Badge
                  className="text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                  style={{ backgroundColor: "#ef4444", color: "white" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}

        {/* Ajuda */}
        {!compact && (
          <div className="pt-4 pb-1 px-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#000000' }}>
              Ajuda
            </p>
          </div>
        )}
        {helpItems.map(({ href, icon: Icon, label }) => {
          const active = location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 w-full ${compact ? "justify-center px-2" : "px-3"} py-2.5`}
              title={compact ? label : undefined}
              style={{
                color: '#000000',
                backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!compact && label}
            </Link>
          );
        })}

        {(user?.role === "admin" || user?.role === "master_admin" || user?.role === "company_admin") && (
          <>
            {!compact && (
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: SIDEBAR_SECTION_TEXT }}>
                  Admin
                </p>
              </div>
            )}
            {adminItems.map(({ href, icon: Icon, label }) => {
              const active = location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 w-full ${compact ? "justify-center px-2" : "px-3"} py-2.5`}
                  title={compact ? label : undefined}
                  style={{
                    color: active ? SIDEBAR_ACTIVE_TEXT : SIDEBAR_TEXT,
                    backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!compact && label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Profile */}
      <div
        className="p-3"
        style={{ borderTop: `1px solid ${isDark ? "rgba(148,163,184,0.18)" : "rgba(255,255,255,0.08)"}`, backgroundColor: isDark ? "#111827" : "#ffc30d" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`w-full flex items-center gap-3 rounded-lg transition-colors text-left ${compact ? "justify-center px-2" : "px-3"} py-2.5`}
              title={compact ? "Abrir menu do usuário" : undefined}
              style={{ color: SIDEBAR_TEXT }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <UserAvatar
                user={{
                  name: user?.name,
                  avatarUrl: user?.avatarUrl,
                  avatarColor: (user as any)?.avatarColor,
                  avatarInitials: (user as any)?.avatarInitials,
                }}
                size="sm"
              />
              {!compact && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: isDark ? "#f8fafc" : "#111827" }}>
                    {user?.name ?? "Usuário"}
                  </p>
                  <p className="text-xs truncate" style={{ color: isDark ? "#94a3b8" : "#111827" }}>
                    {user?.email ?? ""}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-[width] duration-300 ease-out ${sidebarCollapsed ? "w-[4.5rem]" : "w-60"}`}
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <SidebarContent compact={sidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="relative w-64 flex flex-col"
            style={{ backgroundColor: SIDEBAR_BG }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4"
              style={{ color: SIDEBAR_TEXT }}
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent compact={false} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden transition-[margin] duration-300 ease-out ${sidebarCollapsed ? "lg:ml-[4.5rem]" : "lg:ml-60"}`}>
        {/* Top Header — only shown when title or backHref is provided */}
        {(title || backHref) && (
          <header className="flex-shrink-0 z-30 backdrop-blur border-b border-border px-4 lg:px-6 h-14 flex items-center gap-4 shadow-sm" style={{ backgroundColor: isDark ? "#111827" : "#ffc30d" }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>

            {backHref && (
              <Link
                href={backHref}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Link>
            )}

            {title && (
              <h1 className="text-base font-semibold text-foreground flex-1 truncate">{title}</h1>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
              <Link
                href="/notifications"
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Link>
            </div>
          </header>
        )}

        {/* Mobile hamburger when no header */}
        {!title && !backHref && (
          <div className="lg:hidden flex-shrink-0 z-30 border-b border-border px-4 h-12 flex items-center justify-between" style={{ backgroundColor: isDark ? "#111827" : "#ffc30d" }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        )}

        {/* Page Content */}
        <main className={`${fullHeight ? "flex-1 overflow-hidden flex flex-col" : "flex-1 overflow-y-auto p-4 lg:p-6"} bg-background text-foreground transition-colors duration-200`}>
          {children}
        </main>
      </div>
      <FloatingAgent compact={sidebarCollapsed} />
    </div>
  );
}
