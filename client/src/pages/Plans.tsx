import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle2, X, Zap, ArrowLeft, Star, Clock,
  ChevronRight, HelpCircle, Users, BarChart2, Bot,
  GitBranch, Calendar, MessageSquare, Shield, Paperclip,
  Bell, Globe, Lock, TrendingUp,
} from "lucide-react";

const BRAND = {
  blue:    "#1561ad",
  blueAlt: "#1c77ac",
  teal:    "#1dbab4",
  orange:  "#fc5226",
};

type BillingCycle = "monthly" | "annual";

const plans = [
  {
    name: "Starter",
    tagline: "Para freelancers e projetos pessoais",
    price: { monthly: 0, annual: 0 },
    color: BRAND.blueAlt,
    highlight: false,
    trial: false,
    cta: "Começar grátis",
    features: {
      "Projetos": "Até 3",
      "Membros por projeto": "Até 5",
      "Armazenamento": "10 GB",
      "Kanban": "3 colunas",
      "Gantt": false,
      "Sprints": false,
      "Calendário": false,
      "IA Integrada": false,
      "Chat de equipe": false,
      "Relatórios em PDF": "Básico",
      "Convite por link": false,
      "Quadro Branco": false,
      "Notificações": true,
      "Controle de acesso": "Básico",
      "Suporte": "E-mail (48h)",
      "Uptime SLA": "99%",
    },
  },
  {
    name: "Pro",
    tagline: "Para equipes em crescimento",
    price: { monthly: 79, annual: 63 },
    color: BRAND.blue,
    highlight: true,
    trial: true,
    cta: "Testar grátis por 15 dias",
    features: {
      "Projetos": "Ilimitados",
      "Membros por projeto": "Ilimitados",
      "Armazenamento": "100 GB",
      "Kanban": "6 colunas + bloqueio",
      "Gantt": true,
      "Sprints": true,
      "Calendário": true,
      "IA Integrada": true,
      "Chat de equipe": true,
      "Relatórios em PDF": "Completo + branding",
      "Convite por link": true,
      "Quadro Branco": true,
      "Notificações": true,
      "Controle de acesso": "Por projeto (4 funções)",
      "Suporte": "Prioritário (8h)",
      "Uptime SLA": "99,5%",
    },
  },
  {
    name: "Enterprise",
    tagline: "Para empresas e múltiplas equipes",
    price: { monthly: 199, annual: 159 },
    color: BRAND.teal,
    highlight: false,
    trial: false,
    cta: "Falar com vendas",
    features: {
      "Projetos": "Ilimitados",
      "Membros por projeto": "Ilimitados",
      "Armazenamento": "Ilimitado",
      "Kanban": "6 colunas + bloqueio",
      "Gantt": true,
      "Sprints": true,
      "Calendário": true,
      "IA Integrada": true,
      "Chat de equipe": true,
      "Relatórios em PDF": "Completo + branding personalizado",
      "Convite por link": true,
      "Quadro Branco": true,
      "Notificações": true,
      "Controle de acesso": "Multi-tenant + SSO",
      "Suporte": "24/7 com gerente de conta",
      "Uptime SLA": "99,9%",
    },
  },
];

const featureGroups = [
  {
    title: "Capacidade",
    icon: BarChart2,
    keys: ["Projetos", "Membros por projeto", "Armazenamento"],
  },
  {
    title: "Ferramentas de Projeto",
    icon: GitBranch,
    keys: ["Kanban", "Gantt", "Sprints", "Calendário", "Quadro Branco"],
  },
  {
    title: "Colaboração",
    icon: MessageSquare,
    keys: ["Chat de equipe", "Convite por link", "Notificações"],
  },
  {
    title: "Inteligência e Relatórios",
    icon: Bot,
    keys: ["IA Integrada", "Relatórios em PDF"],
  },
  {
    title: "Segurança e Suporte",
    icon: Shield,
    keys: ["Controle de acesso", "Suporte", "Uptime SLA"],
  },
];

const faqs = [
  {
    q: "O período de teste do plano Pro é gratuito?",
    a: "Sim. Você tem 15 dias completos para testar todas as funcionalidades do plano Pro sem precisar inserir cartão de crédito. Ao final do período, você escolhe se deseja assinar ou continuar no plano gratuito.",
  },
  {
    q: "Posso mudar de plano a qualquer momento?",
    a: "Sim. Você pode fazer upgrade ou downgrade a qualquer momento. No upgrade, o valor é cobrado proporcionalmente ao período restante. No downgrade, o crédito é aplicado na próxima fatura.",
  },
  {
    q: "O que acontece com meus dados se eu cancelar?",
    a: "Seus dados ficam disponíveis por 30 dias após o cancelamento. Você pode exportar projetos, tarefas e relatórios nesse período. Após 30 dias, os dados são removidos permanentemente.",
  },
  {
    q: "Qual a diferença entre o plano anual e mensal?",
    a: "O plano anual oferece desconto de 20% em relação ao mensal. O valor é cobrado integralmente no início do período anual. Não há reembolso proporcional em cancelamentos antecipados no plano anual.",
  },
  {
    q: "O plano Enterprise suporta múltiplas empresas?",
    a: "Sim. O Enterprise inclui suporte multi-tenant, permitindo que você gerencie múltiplas empresas ou departamentos com isolamento de dados, SSO corporativo e painel administrativo centralizado.",
  },
];

export default function Plans() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCta = (plan: typeof plans[0]) => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BRAND.blue }}>
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-base" style={{ color: BRAND.blue }}>Orbita</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isAuthenticated && !loading && (
              <>
                <Button variant="ghost" size="sm" onClick={() => window.location.href = getLoginUrl()}>
                  Entrar
                </Button>
                <Button size="sm" className="text-white" style={{ background: BRAND.blue }}
                  onClick={() => window.location.href = getLoginUrl()}>
                  Criar conta
                </Button>
              </>
            )}
            {isAuthenticated && (
              <Button size="sm" className="text-white" style={{ background: BRAND.blue }}
                onClick={() => navigate("/dashboard")}>
                Ir para o Dashboard
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 text-center" style={{
        background: `linear-gradient(180deg, ${BRAND.blue}08 0%, white 100%)`,
      }}>
        <Badge className="mb-4 text-xs font-semibold px-3 py-1 text-white border-0"
          style={{ background: BRAND.blue }}>
          Planos e Preços
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Escolha o plano ideal para{" "}
          <span style={{
            background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.teal})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            sua equipe
          </span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
          Comece gratuitamente e evolua conforme seu time cresce. Sem surpresas na fatura.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-border bg-muted/50">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              billing === "monthly"
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              billing === "annual"
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Anual
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: BRAND.teal }}>
              -20%
            </span>
          </button>
        </div>
      </section>

      {/* Plan cards */}
      <section className="pb-20 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => {
            const price = billing === "annual" ? plan.price.annual : plan.price.monthly;
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 p-8 transition-all ${
                  plan.highlight ? "shadow-2xl scale-[1.03]" : "bg-white shadow-sm hover:shadow-md"
                }`}
                style={plan.highlight ? {
                  background: `linear-gradient(160deg, ${BRAND.blue}, ${BRAND.blueAlt})`,
                  borderColor: BRAND.blue,
                } : {
                  borderColor: `${plan.color}35`,
                }}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 text-xs font-bold text-white border-0 shadow"
                      style={{ background: BRAND.orange }}>
                      <Star className="w-3 h-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                {plan.trial && (
                  <div className="absolute -top-4 right-4">
                    <Badge className="px-3 py-1 text-xs font-bold border-0 shadow text-white"
                      style={{ background: BRAND.teal }}>
                      <Clock className="w-3 h-3 mr-1" />
                      15 dias grátis
                    </Badge>
                  </div>
                )}

                <div className="mb-5">
                  <h2 className={`text-xl font-bold mb-1 ${plan.highlight ? "text-white" : ""}`}>{plan.name}</h2>
                  <p className={`text-sm ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}>{plan.tagline}</p>
                </div>

                <div className="mb-6">
                  {price === 0 ? (
                    <span className={`text-4xl font-bold ${plan.highlight ? "text-white" : ""}`}>Grátis</span>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className={`text-4xl font-bold ${plan.highlight ? "text-white" : ""}`}>
                          R$ {price}
                        </span>
                        <span className={`text-sm mb-2 ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}>
                          /mês
                        </span>
                      </div>
                      {billing === "annual" && (
                        <p className={`text-xs mt-1 ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                          Cobrado anualmente · R$ {price * 12}/ano
                        </p>
                      )}
                    </>
                  )}
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2 font-semibold mb-6"
                  onClick={() => handleCta(plan)}
                  style={plan.highlight
                    ? { background: "white", color: BRAND.blue }
                    : { background: plan.color, color: "white" }
                  }
                >
                  {plan.cta}
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <ul className="space-y-2.5">
                  {Object.entries(plan.features).slice(0, 8).map(([key, val]) => (
                    <li key={key} className="flex items-center gap-2.5 text-sm">
                      {val === false ? (
                        <X className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-white/30" : "text-muted-foreground/40"}`} />
                      ) : (
                        <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-white/80" : ""}`}
                          style={!plan.highlight ? { color: BRAND.teal } : undefined} />
                      )}
                      <span className={val === false
                        ? (plan.highlight ? "text-white/40" : "text-muted-foreground/50 line-through")
                        : (plan.highlight ? "text-white/90" : "text-foreground/80")
                      }>
                        {val === true ? key : val === false ? key : `${key}: ${val}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-20 px-4" style={{ background: `${BRAND.blue}04` }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Comparação completa de funcionalidades</h2>
            <p className="text-muted-foreground">Veja exatamente o que está incluído em cada plano.</p>
          </div>

          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            {/* Header row */}
            <div className="grid grid-cols-4 border-b border-border">
              <div className="p-5 font-semibold text-sm text-muted-foreground">Funcionalidade</div>
              {plans.map((p) => (
                <div key={p.name} className="p-5 text-center">
                  <span className="font-bold text-sm" style={{ color: p.highlight ? BRAND.blue : undefined }}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            {featureGroups.map((group, gi) => (
              <div key={group.title}>
                {/* Group header */}
                <div className="grid grid-cols-4 bg-muted/30 border-b border-border">
                  <div className="p-4 col-span-4 flex items-center gap-2">
                    <group.icon className="w-4 h-4" style={{ color: BRAND.blue }} />
                    <span className="font-semibold text-sm" style={{ color: BRAND.blue }}>{group.title}</span>
                  </div>
                </div>
                {group.keys.map((key, ki) => (
                  <div
                    key={key}
                    className={`grid grid-cols-4 border-b border-border last:border-0 ${
                      ki % 2 === 0 ? "bg-white" : "bg-muted/10"
                    }`}
                  >
                    <div className="p-4 text-sm text-foreground/80">{key}</div>
                    {plans.map((p) => {
                      const val = p.features[key as keyof typeof p.features];
                      return (
                        <div key={p.name} className="p-4 text-center flex items-center justify-center">
                          {val === true ? (
                            <CheckCircle2 className="w-5 h-5" style={{ color: BRAND.teal }} />
                          ) : val === false ? (
                            <X className="w-4 h-4 text-muted-foreground/40" />
                          ) : (
                            <span className="text-sm text-foreground/80">{val}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-16 px-4 bg-white border-y border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: Lock, title: "Dados Seguros", desc: "Criptografia em trânsito e em repouso. Seus dados nunca são compartilhados com terceiros." },
            { icon: TrendingUp, title: "Alta Performance", desc: "Infraestrutura escalável com SLA de uptime e resposta em milissegundos." },
            { icon: Globe, title: "Sem instalação", desc: "Plataforma 100% web, acessível de qualquer dispositivo e sistema operacional." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${BRAND.teal}15` }}>
                <Icon className="w-6 h-6" style={{ color: BRAND.teal }} />
              </div>
              <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Perguntas frequentes</h2>
            <p className="text-muted-foreground">Tire suas dúvidas sobre os planos e funcionalidades.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-sm pr-4">{faq.q}</span>
                  <HelpCircle className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    openFaq === i ? "" : "text-muted-foreground"
                  }`} style={openFaq === i ? { color: BRAND.blue } : undefined} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4" style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.blueAlt})` }}>
        <div className="max-w-xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-5">
            <Users className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Comece hoje mesmo</h2>
          <p className="text-white/75 mb-8 leading-relaxed">
            Crie sua conta grátis em menos de 1 minuto. Sem cartão de crédito.
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = getLoginUrl()}
            className="gap-2 px-8 font-semibold"
            style={{ background: "white", color: BRAND.blue }}
          >
            Criar conta grátis
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-white">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
              <Zap className="w-3 h-3" style={{ color: BRAND.blue }} />
            </div>
            <span className="font-medium" style={{ color: BRAND.blue }}>Orbita</span>
            <span>— Gerenciamento de Projetos</span>
          </div>
          <span>© {new Date().getFullYear()} Orbita. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
