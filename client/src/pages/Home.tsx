import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Kanban, Bell, Bot, Shield, Paperclip,
  ArrowRight, CheckCircle2, Zap, Users, BarChart2, Calendar,
  GitBranch, MessageSquare, Star, ChevronRight, Clock,
  TrendingUp, Lock, Globe,
} from "lucide-react";

// ─── Brand colors ─────────────────────────────────────────────────────────────
const BRAND = {
  blue:    "#785500",
  blueAlt: "#9a6b00",
  teal:    "#1dbab4",
  orange:  "#fc5226",
};

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    { icon: Kanban,         title: "Quadro Kanban",            desc: "Organize tarefas em colunas visuais com drag-and-drop, 6 status e filtros avançados." },
    { icon: Bot,            title: "IA Integrada",             desc: "Análise de carga de trabalho, priorização inteligente e relatórios automáticos com IA." },
    { icon: BarChart2,      title: "Relatórios e PDFs",        desc: "Exporte relatórios profissionais em PDF: dashboard, sprints, membros e tarefas bloqueadas." },
    { icon: GitBranch,      title: "Gráfico de Gantt",         desc: "Linha do tempo interativa com detecção de conflitos e visualização de dependências." },
    { icon: Calendar,       title: "Sprints e Calendário",     desc: "Planeje sprints semanais, acompanhe metas e visualize entregas no calendário." },
    { icon: MessageSquare,  title: "Chat e Colaboração",       desc: "Chat em tarefas, mensagens privadas e grupos para comunicação centralizada." },
    { icon: Bell,           title: "Notificações em Tempo Real", desc: "Alertas instantâneos sobre atribuições, comentários, prazos e status." },
    { icon: Shield,         title: "Controle de Acesso",       desc: "Funções por projeto (Dono, Admin, Membro, Visualizador) com permissões granulares." },
    { icon: Paperclip,      title: "Anexos em Nuvem",          desc: "Upload de documentos e imagens com armazenamento seguro e visualização inline." },
  ];

  const plans = [
    {
      name: "Starter",
      price: { monthly: 0, annual: 0 },
      description: "Para freelancers e projetos pessoais",
      color: BRAND.blueAlt,
      highlight: false,
      trial: false,
      features: [
        "Até 3 projetos",
        "Até 5 membros por projeto",
        "Kanban básico (3 colunas)",
        "10 GB de armazenamento",
        "Relatórios simples",
        "Suporte por e-mail",
      ],
      cta: "Começar grátis",
    },
    {
      name: "Pro",
      price: { monthly: 79, annual: 63 },
      description: "Para equipes em crescimento",
      color: BRAND.blue,
      highlight: true,
      trial: true,
      features: [
        "Projetos ilimitados",
        "Membros ilimitados",
        "Kanban completo (6 colunas)",
        "Gantt, Sprints e Calendário",
        "IA integrada (análise + relatórios)",
        "Chat de equipe e tarefas",
        "100 GB de armazenamento",
        "Relatórios em PDF com branding",
        "Convite por link",
        "Suporte prioritário",
      ],
      cta: "Testar grátis por 15 dias",
    },
    {
      name: "Enterprise",
      price: { monthly: 199, annual: 159 },
      description: "Para empresas e múltiplas equipes",
      color: BRAND.teal,
      highlight: false,
      trial: false,
      features: [
        "Tudo do plano Pro",
        "Multi-tenant (múltiplas empresas)",
        "Admin Master centralizado",
        "SSO / Login corporativo",
        "Armazenamento ilimitado",
        "SLA de 99,9% de uptime",
        "Onboarding dedicado",
        "Suporte 24/7 com gerente de conta",
      ],
      cta: "Falar com vendas",
    },
  ];

  const stats = [
    { value: "98%", label: "Satisfação dos clientes" },
    { value: "3x", label: "Mais produtividade" },
    { value: "50%", label: "Redução de retrabalho" },
    { value: "24/7", label: "Disponibilidade" },
  ];

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND.blue }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ color: BRAND.blue }}>Orbita</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Preços</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => window.location.href = getLoginUrl()}
              className="text-sm font-medium"
            >
              Entrar
            </Button>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              className="gap-2 text-sm text-white shadow-sm"
              style={{ background: BRAND.blue }}
            >
              Criar conta grátis
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden" style={{
        background: `linear-gradient(135deg, ${BRAND.blue}08 0%, ${BRAND.teal}08 100%)`,
      }}>
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND.teal}, transparent 70%)`, transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-8 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND.blue}, transparent 70%)`, transform: "translate(-30%, 30%)" }} />

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium mb-8"
            style={{ background: `${BRAND.blue}10`, borderColor: `${BRAND.blue}30`, color: BRAND.blue }}>
            <Zap className="w-3.5 h-3.5" />
            Plataforma de Gerenciamento de Projetos
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
            Gerencie projetos com{" "}
            <span style={{
              background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.teal})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              inteligência
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Organize equipes, acompanhe entregas e tome decisões com dados.
            Uma plataforma completa com IA, Kanban, Gantt, Sprints e muito mais.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="gap-2 text-base px-8 text-white shadow-lg"
              style={{ background: BRAND.blue }}
            >
              Criar conta grátis
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
              className="gap-2 text-base px-8 border-2"
              style={{ borderColor: BRAND.blue, color: BRAND.blue }}
            >
              Ver planos e preços
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle2, label: "Sem cartão de crédito" },
              { icon: CheckCircle2, label: "15 dias grátis no Pro" },
              { icon: CheckCircle2, label: "Cancele quando quiser" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: BRAND.teal }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <section className="py-14 px-4 border-y border-border" style={{ background: BRAND.blue }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-4xl font-bold text-white mb-1">{value}</p>
              <p className="text-sm text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-xs font-semibold px-3 py-1 text-white border-0"
              style={{ background: BRAND.teal }}>
              Funcionalidades
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que sua equipe precisa
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Uma plataforma completa para gerenciar projetos do início ao fim, com ferramentas profissionais integradas.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 border border-border hover:shadow-md transition-all duration-200 group hover:border-primary/30"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors"
                  style={{ background: `${BRAND.blue}12` }}>
                  <Icon className="w-5 h-5" style={{ color: BRAND.blue }} />
                </div>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="planos" className="py-24 px-4" style={{ background: `${BRAND.blue}05` }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-xs font-semibold px-3 py-1 text-white border-0"
              style={{ background: BRAND.blue }}>
              Planos e Preços
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o plano ideal para sua equipe
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Comece gratuitamente e evolua conforme sua equipe cresce. Economize até 20% no plano anual.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 border-2 transition-all ${
                  plan.highlight
                    ? "shadow-2xl scale-105"
                    : "bg-white shadow-sm hover:shadow-md"
                }`}
                style={plan.highlight ? {
                  background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.blueAlt})`,
                  borderColor: BRAND.blue,
                } : {
                  borderColor: `${plan.color}30`,
                }}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 text-xs font-bold text-white border-0 shadow-md"
                      style={{ background: BRAND.orange }}>
                      <Star className="w-3 h-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                {plan.trial && (
                  <div className="absolute -top-4 right-4">
                    <Badge className="px-3 py-1 text-xs font-bold border-0 shadow-md"
                      style={{ background: BRAND.teal, color: "white" }}>
                      <Clock className="w-3 h-3 mr-1" />
                      15 dias grátis
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-foreground"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  {plan.price.monthly === 0 ? (
                    <div className={`text-4xl font-bold ${plan.highlight ? "text-white" : "text-foreground"}`}>
                      Grátis
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className={`text-4xl font-bold ${plan.highlight ? "text-white" : "text-foreground"}`}>
                          R$ {plan.price.monthly}
                        </span>
                        <span className={`text-sm mb-1.5 ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}>
                          /mês
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                        ou R$ {plan.price.annual}/mês no plano anual (economize 20%)
                      </p>
                    </>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? "text-white/80" : ""}`}
                        style={!plan.highlight ? { color: BRAND.teal } : undefined} />
                      <span className={`text-sm ${plan.highlight ? "text-white/90" : "text-foreground/80"}`}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className="w-full gap-2 font-semibold text-sm"
                  onClick={() => window.location.href = getLoginUrl()}
                  style={plan.highlight ? {
                    background: "white",
                    color: BRAND.blue,
                  } : {
                    background: plan.color,
                    color: "white",
                  }}
                >
                  {plan.cta}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Annual note */}
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              Todos os preços em BRL. Plano anual cobrado anualmente.{" "}
              <span className="font-medium" style={{ color: BRAND.blue }}>Cancele a qualquer momento.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust section ───────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: Lock, title: "Dados Seguros", desc: "Criptografia em trânsito e em repouso. Seus dados nunca são compartilhados." },
              { icon: TrendingUp, title: "Alta Performance", desc: "Infraestrutura escalável com uptime de 99,9% e resposta em milissegundos." },
              { icon: Globe, title: "Acesso em Qualquer Lugar", desc: "Plataforma 100% web, acessível de qualquer dispositivo, sem instalação." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: `${BRAND.teal}15` }}>
                  <Icon className="w-7 h-7" style={{ color: BRAND.teal }} />
                </div>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-4" style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.blueAlt})` }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Pronto para transformar sua equipe?
          </h2>
          <p className="text-white/75 mb-10 text-lg leading-relaxed">
            Comece hoje com o plano gratuito ou teste o Pro por 15 dias sem compromisso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="gap-2 px-8 text-base font-semibold"
              style={{ background: "white", color: BRAND.blue }}
            >
              Criar conta grátis
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
              className="gap-2 px-8 text-base font-semibold border-white/40 text-white hover:bg-white/10"
            >
              Ver planos
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10 px-4 bg-white">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BRAND.blue }}>
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-base" style={{ color: BRAND.blue }}>Orbita</span>
              <span className="text-muted-foreground text-sm">— Gerenciamento de Projetos</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
              <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
              <button
                onClick={() => window.location.href = getLoginUrl()}
                className="hover:text-foreground transition-colors"
              >
                Entrar
              </button>
            </div>
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Orbita. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
