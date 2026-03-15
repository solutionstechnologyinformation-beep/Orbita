import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Bell,
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
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const SIDEBAR_BG = "#1561ad";
const SIDEBAR_TEXT = "#ffffff";
const SIDEBAR_ACTIVE_BG = "rgba(255,255,255,0.18)";
const SIDEBAR_HOVER_BG = "rgba(255,255,255,0.10)";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projetos" },
  { href: "/gantt", icon: GanttChartSquare, label: "Gantt" },
  { href: "/sprints", icon: Target, label: "Sprints" },
  { href: "/scheduling", icon: CalendarRange, label: "Programação" },
  { href: "/calendar", icon: CalendarDays, label: "Calendário" },
  { href: "/team-chat", icon: MessageSquare, label: "Chat de Tarefas" },
  { href: "/whiteboard", icon: PenSquare, label: "Quadro Branco" },
  { href: "/relatorios", icon: FileBarChart, label: "Relatórios" },
  { href: "/notifications", icon: Bell, label: "Notificações" },
  { href: "/chat", icon: Bot, label: "Chat IA" },
];

const adminItems = [
  { href: "/admin", icon: Shield, label: "Admin" },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
}

export default function AppLayout({ children, title, backHref }: AppLayoutProps) {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ backgroundColor: SIDEBAR_BG }}>
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-3 px-4 py-5 border-b"
        style={{ backgroundColor: SIDEBAR_BG, borderColor: "rgba(0,0,0,0.15)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.20)" }}
        >
          <Zap className="w-4 h-4" style={{ color: "#ffffff" }} />
        </div>
        <span className="font-bold text-xl tracking-tight" style={{ color: SIDEBAR_TEXT }}>
          Orbita
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" style={{ backgroundColor: SIDEBAR_BG }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/dashboard" && location.startsWith(href));

          // Item especial: Projetos com submenu de CRS
          if (href === "/projects") {
            return (
              <div key={href}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative w-full cursor-pointer"
                  style={{
                    color: SIDEBAR_TEXT,
                    backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
                    fontWeight: active ? 700 : 500,
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
                  {active && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                      style={{ backgroundColor: "#1dbab4" }}
                    />
                  )}
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: SIDEBAR_TEXT }} />
                  <span className="flex-1">{label}</span>
                  {crsList.length > 0 && (
                    crsExpanded
                      ? <ChevronDown className="w-3 h-3" style={{ color: "rgba(255,255,255,0.7)" }} />
                      : <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.7)" }} />
                  )}
                </div>
                {/* Submenu de CRS */}
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
                            color: crsActive ? "#1dbab4" : "rgba(255,255,255,0.75)",
                            backgroundColor: crsActive ? SIDEBAR_ACTIVE_BG : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = crsActive ? SIDEBAR_ACTIVE_BG : "transparent";
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
                        style={{ color: "rgba(255,255,255,0.5)" }}
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative w-full"
              style={{
                color: SIDEBAR_TEXT,
                backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
                fontWeight: active ? 700 : 500,
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              {active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                  style={{ backgroundColor: "#1dbab4" }}
                />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: SIDEBAR_TEXT }} />
              <span className="flex-1">{label}</span>
              {label === "Notificações" && unreadCount > 0 && (
                <Badge
                  className="text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                  style={{ backgroundColor: "#fc5226", color: "white" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
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
                    color: SIDEBAR_TEXT,
                    backgroundColor: active ? SIDEBAR_ACTIVE_BG : "transparent",
                    fontWeight: active ? 700 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: SIDEBAR_TEXT }} />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Profile */}
      <div
        className="border-t p-3"
        style={{ backgroundColor: SIDEBAR_BG, borderColor: "rgba(0,0,0,0.15)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
              style={{ color: SIDEBAR_TEXT }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER_BG; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback
                  className="text-xs font-semibold"
                  style={{ backgroundColor: "rgba(255,255,255,0.20)", color: "white" }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: SIDEBAR_TEXT }}>
                  {user?.name ?? "Usuário"}
                </p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.65)" }}>
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
        {/* Top Header */}
        <header className="flex-shrink-0 z-30 bg-white/90 backdrop-blur border-b border-border px-4 lg:px-6 h-14 flex items-center gap-4 shadow-sm">
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

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
