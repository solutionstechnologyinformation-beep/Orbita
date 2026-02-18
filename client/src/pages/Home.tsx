import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Kanban,
  Bell,
  Bot,
  Shield,
  Paperclip,
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
} from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    { icon: LayoutDashboard, title: "Dashboard Inteligente", desc: "Visão geral de todos os projetos, tarefas e métricas em tempo real." },
    { icon: Kanban, title: "Quadro Kanban", desc: "Organize tarefas em colunas visuais com drag-and-drop e filtros avançados." },
    { icon: Bot, title: "IA Integrada", desc: "Análise de carga de trabalho, priorização inteligente e relatórios automáticos." },
    { icon: Bell, title: "Notificações em Tempo Real", desc: "Alertas instantâneos sobre atribuições, comentários e atualizações." },
    { icon: Paperclip, title: "Anexos em Nuvem", desc: "Upload de documentos e imagens com armazenamento seguro na nuvem." },
    { icon: Shield, title: "Painel Administrativo", desc: "Gerenciamento completo de usuários, permissões e logs de atividade." },
  ];

  return (
    <div className="min-h-screen animated-bg text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Suple</span>
          </div>
          <Button
onClick={() => window.location.href = getLoginUrl()}
          className="gap-2 bg-primary hover:bg-primary/90"
          >
            Entrar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-sm text-muted-foreground mb-8 border border-border/50">
            <Zap className="w-3.5 h-3.5 text-primary" />
            Plataforma de Gerenciamento de Projetos
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Gerencie projetos com{" "}
            <span className="gradient-text">inteligência</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Organize equipes, priorize tarefas e acompanhe o progresso com IA integrada.
            Tudo em uma plataforma elegante e poderosa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="gap-2 text-base px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
            >
              Começar agora
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle2, label: "Kanban visual" },
              { icon: CheckCircle2, label: "Chat com IA" },
              { icon: CheckCircle2, label: "Notificações em tempo real" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que sua equipe precisa
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Uma plataforma completa para gerenciar projetos do início ao fim.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass rounded-2xl p-6 hover:border-primary/40 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center glass rounded-3xl p-12">
          <Users className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-muted-foreground mb-8">
            Acesse agora e transforme a forma como sua equipe trabalha.
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = getLoginUrl()}
            className="gap-2 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
          >
            Acessar a plataforma
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            Suple — Gerenciamento de Projetos
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
