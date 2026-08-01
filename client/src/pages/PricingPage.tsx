import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, Zap, Clock, Users, BarChart2, Calendar, MessageSquare, Shield } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";

type BillingCycle = "monthly" | "annual";

// Cores da LS Solutions
const LS_COLORS = {
  yellow: "#FFC30D",
  black: "#1a1a1a",
  green: "#00AA00",
  white: "#FFFFFF",
};

const PLANS = [
  {
    id: 1,
    name: "Starter",
    tagline: "Perfeito para começar",
    monthlyPrice: 29,
    annualPrice: 290,
    maxUsers: 3,
    maxProjects: 5,
    highlight: false,
    features: [
      "Até 3 usuários",
      "Até 5 projetos",
      "Calendário básico",
      "Google Calendar integrado",
      "Até 10 GB de armazenamento",
      "Suporte por e-mail",
      "Relatórios básicos",
    ],
    notIncluded: [
      "Kanban avançado",
      "Gantt chart",
      "Sprints",
      "IA integrada",
      "Chat de equipe",
      "Controle de acesso granular",
    ],
  },
  {
    id: 2,
    name: "Basic",
    tagline: "Para equipes em crescimento",
    monthlyPrice: 59,
    annualPrice: 590,
    maxUsers: 10,
    maxProjects: 20,
    highlight: true,
    trial: true,
    features: [
      "Até 10 usuários",
      "Até 20 projetos",
      "Calendário avançado",
      "Google Calendar sincronizado",
      "Até 50 GB de armazenamento",
      "Kanban com drag-and-drop",
      "Gantt chart",
      "Sprints",
      "Suporte prioritário",
      "Relatórios completos",
    ],
    notIncluded: [
      "IA integrada",
      "Chat de equipe",
      "Controle de acesso granular",
    ],
  },
  {
    id: 3,
    name: "Pro",
    tagline: "Para empresas",
    monthlyPrice: 89,
    annualPrice: 890,
    maxUsers: 999,
    maxProjects: 999,
    highlight: false,
    features: [
      "Usuários ilimitados",
      "Projetos ilimitados",
      "Calendário completo",
      "Google Calendar totalmente sincronizado",
      "Armazenamento ilimitado",
      "Kanban completo",
      "Gantt chart avançado",
      "Sprints com planejamento",
      "IA integrada para análises",
      "Chat de equipe",
      "Relatórios personalizados",
      "Suporte 24/7",
      "Controle de acesso granular",
      "API de integração",
    ],
    notIncluded: [],
  },
];

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const userQ = trpc.auth.me.useQuery();
  const user = userQ.data;
  const createCheckoutMut = trpc.subscription.createCheckoutSession.useMutation();
  const statusQ = trpc.subscription.getStatus.useQuery(undefined, { enabled: !!user });

  const handleSelectPlan = async (planId: number) => {
    if (!user) {
      toast.error("Faça login para contratar um plano");
      return;
    }

    try {
      const result = await createCheckoutMut.mutateAsync({
        planId,
        billingCycle,
      });
      
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar sessão de checkout");
    }
  };

  const getPrice = (plan: typeof PLANS[0]) => {
    if (billingCycle === "annual") {
      return Math.floor(plan.annualPrice / 12);
    }
    return plan.monthlyPrice;
  };

  const getTotal = (plan: typeof PLANS[0]) => {
    if (billingCycle === "annual") {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  return (
    <AppLayout title="Planos e Preços">
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        {/* Header */}
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-5xl font-bold text-black mb-4">Planos Simples e Transparentes</h1>
          <p className="text-xl text-gray-600 mb-8">
            Escolha o plano perfeito para sua equipe. Todos incluem Google Calendar integrado e 15 dias de trial.
          </p>

          {/* Billing Toggle */}
          <div className="flex justify-center gap-4 mb-12">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-yellow-400 text-black"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              style={billingCycle === "monthly" ? { backgroundColor: LS_COLORS.yellow } : {}}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === "annual"
                  ? "bg-yellow-400 text-black"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              style={billingCycle === "annual" ? { backgroundColor: LS_COLORS.yellow } : {}}
            >
              Anual (2 meses grátis)
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="container mx-auto px-4 pb-16">
          <div className="grid md:grid-cols-3 gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative transition-transform hover:scale-105 ${
                  plan.highlight ? "md:scale-105" : ""
                }`}
              >
                {plan.highlight && (
                  <div
                    className="absolute -top-4 left-1/2 transform -translate-x-1/2"
                    style={{ backgroundColor: LS_COLORS.yellow }}
                  >
                    <Badge className="text-black font-bold">MAIS POPULAR</Badge>
                  </div>
                )}

                <Card
                  className={`h-full flex flex-col ${
                    plan.highlight
                      ? "border-2 shadow-xl"
                      : "border border-gray-200"
                  }`}
                  style={
                    plan.highlight
                      ? { borderColor: LS_COLORS.yellow }
                      : {}
                  }
                >
                  <CardHeader>
                    <CardTitle className="text-2xl text-black">{plan.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-2">{plan.tagline}</p>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    {/* Pricing */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-4xl font-bold"
                          style={{ color: LS_COLORS.yellow }}
                        >
                          R${getPrice(plan)}
                        </span>
                        <span className="text-gray-600">/mês</span>
                      </div>
                      {billingCycle === "annual" && (
                        <p className="text-sm text-green-600 mt-2">
                          Total: R${getTotal(plan)}/ano
                        </p>
                      )}
                      {plan.trial && (
                        <p className="text-sm text-gray-600 mt-2">
                          <Clock className="inline w-4 h-4 mr-1" />
                          15 dias de trial grátis
                        </p>
                      )}
                    </div>

                    {/* CTA Button */}
            <Button
              onClick={() => handleSelectPlan(plan.id)}
              disabled={createCheckoutMut.isPending}
              className="w-full mb-6 font-semibold"
              style={{ backgroundColor: LS_COLORS.yellow, color: LS_COLORS.black }}
            >
              {user ? "Começar agora" : "Faça login para contratar"}
            </Button>

                    {/* Features */}
                    <div className="space-y-3 flex-1">
                      <p className="font-semibold text-sm text-gray-700">Incluído:</p>
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: LS_COLORS.green }} />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}

                      {plan.notIncluded.length > 0 && (
                        <>
                          <p className="font-semibold text-sm text-gray-700 mt-4">Não incluído:</p>
                          {plan.notIncluded.map((feature, i) => (
                            <div key={i} className="flex gap-3 text-sm">
                              <X className="w-5 h-5 flex-shrink-0 text-gray-400" />
                              <span className="text-gray-500">{feature}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-black text-white py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-12 text-center">Perguntas Frequentes</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex gap-2">
                  <Zap className="w-5 h-5" style={{ color: LS_COLORS.yellow }} />
                  Posso mudar de plano depois?
                </h3>
                <p className="text-gray-300">
                  Sim! Você pode fazer upgrade ou downgrade a qualquer momento. As mudanças entram em vigor no próximo ciclo de faturamento.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 flex gap-2">
                  <Calendar className="w-5 h-5" style={{ color: LS_COLORS.yellow }} />
                  Como funciona o trial?
                </h3>
                <p className="text-gray-300">
                  Todos os planos incluem 15 dias de trial grátis. Sem necessidade de cartão de crédito para começar.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 flex gap-2">
                  <Users className="w-5 h-5" style={{ color: LS_COLORS.yellow }} />
                  Qual é o limite de usuários?
                </h3>
                <p className="text-gray-300">
                  Starter: 3 usuários. Basic: 10 usuários. Pro: Ilimitados. Você pode adicionar mais usuários a qualquer momento.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 flex gap-2">
                  <Shield className="w-5 h-5" style={{ color: LS_COLORS.yellow }} />
                  Meus dados estão seguros?
                </h3>
                <p className="text-gray-300">
                  Sim! Usamos criptografia de ponta a ponta e conformidade com LGPD. Seus dados são sua propriedade.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="bg-white py-16 border-t-2" style={{ borderTopColor: LS_COLORS.yellow }}>
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-black mb-4">Pronto para começar?</h2>
            <p className="text-gray-600 mb-8">
              Teste gratuitamente por 15 dias. Sem cartão de crédito necessário.
            </p>
            <Button
              className="px-8 py-3 text-lg font-semibold text-black"
              style={{ backgroundColor: LS_COLORS.yellow }}
            >
              Comece seu trial agora
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
