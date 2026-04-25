import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
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
  MessageSquare,
  PenSquare,
  Shield,
  Target,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { UserAvatar } from "./UserAvatar";
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
  { href: "/relatorios", icon: FileBarChart, label: "Relatórios" },
  { href: "/team-chat", icon: MessageSquare, label: "Chat de Tarefas" },
  { href: "/whiteboard", icon: PenSquare, label: "Quadro Branco" },
  { href: "/notifications", icon: Bell, label: "Notificações" },
  { href: "/chat", icon: Bot, label: "Chat IA" },
];

const adminItems = [
  { href: "/admin", icon: Shield, label: "Admin" },
];

const helpItems = [
  { href: "/manual", icon: BookOpen, label: "Manual de Uso" },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  /** Se true, remove o padding do main e usa overflow-hidden para suportar SplitLayout */
  fullHeight?: boolean;
}

export default function AppLayout({ children, title, backHref, fullHeight }: AppLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const initials = user?.avatarInitials ||
    (user?.name
      ? user.name.trim().split(/\s+/).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
      : "U");

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ backgroundColor: SIDEBAR_BG }}>
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Orbita icon — circular orbit */}
        <div className="w-8 h-8 flex-shrink-0 relative">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="16" cy="16" r="14" stroke="#3b82f6" strokeWidth="2" fill="none" />
            <circle cx="16" cy="16" r="4" fill="#3b82f6" />
            <ellipse cx="16" cy="16" rx="14" ry="6" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" fill="none" transform="rotate(-30 16 16)" />
          </svg>
        </div>
        <span className="font-bold text-xl tracking-tight text-white">Orbita</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/dashboard" && href !== "/kanban" && location.startsWith(href));

          // Item especial: Projetos com submenu de Contrato
          if (href === "/projects") {
            return (
              <div key={href}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer"
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
                  <span className="flex-1">{label}</span>
                  {crsList.length > 0 && (
                    crsExpanded
                      ? <ChevronDown className="w-3 h-3 opacity-60" />
                      : <ChevronRight className="w-3 h-3 opacity-60" />
                  )}
                </div>
                {/* Submenu de Contrato */}
                {crsExpanded && crsList.length > 0 && (
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full"
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
              <span className="flex-1">{label}</span>
              {label === "Notificações" && unreadCount > 0 && (
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
        <div className="pt-4 pb-1 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: SIDEBAR_SECTION_TEXT }}>
            Ajuda
          </p>
        </div>
        {helpItems.map(({ href, icon: Icon, label }) => {
          const active = location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full"
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
              {label}
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: SIDEBAR_SECTION_TEXT }}>
                Admin
              </p>
            </div>
            {adminItems.map(({ href, icon: Icon, label }) => {
              const active = location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full"
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
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Profile */}
      <div
        className="p-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#f1f5f9" }}>
                  {user?.name ?? "Usuário"}
                </p>
                <p className="text-xs truncate" style={{ color: "rgba(148,163,184,0.8)" }}>
                  {user?.email ?? ""}
                </p>
              </div>
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
        className="hidden lg:flex flex-col w-60 fixed top-0 left-0 bottom-0 z-40"
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <SidebarContent />
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
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-60 flex flex-col h-screen overflow-hidden">
        {/* Top Header — only shown when title or backHref is provided */}
        {(title || backHref) && (
          <header className="flex-shrink-0 z-30 bg-white/95 backdrop-blur border-b border-border px-4 lg:px-6 h-14 flex items-center gap-4 shadow-sm">
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
          <div className="lg:hidden flex-shrink-0 z-30 bg-white/95 border-b border-border px-4 h-12 flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className={fullHeight ? "flex-1 overflow-hidden flex flex-col" : "flex-1 overflow-y-auto p-4 lg:p-6"}>
          {children}
        </main>
      </div>
    </div>
  );
}
