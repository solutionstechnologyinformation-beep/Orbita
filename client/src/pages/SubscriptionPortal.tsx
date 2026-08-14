import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Calendar, CreditCard, Download } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useTheme } from "@/contexts/ThemeContext";

export function SubscriptionPortal() {
  const { theme } = useTheme();
  const brandAccent = theme === "dark" ? "var(--brand-accent)" : "#FFC30D";
  const brandAccentForeground = theme === "dark" ? "var(--brand-accent-foreground)" : "#111827";
  const statusQ = trpc.subscription.getStatus.useQuery();
  const invoicesQ = trpc.subscription.getInvoices.useQuery();
  const cancelMut = trpc.subscription.cancel.useMutation();

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) {
      return;
    }

    try {
      await cancelMut.mutateAsync({
        reason: "Cancelado pelo usuário",
      });
      toast.success("Assinatura cancelada com sucesso");
      statusQ.refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar assinatura");
    }
  };

  const status = statusQ.data;
  const invoices = invoicesQ.data || [];

  return (
    <AppLayout title="Minha Assinatura">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Portal de Assinatura</h1>

        {/* Status da Assinatura */}
        {status?.hasSubscription ? (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Card Principal */}
            <Card className="border-2" style={{ borderColor: brandAccent }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Plano Ativo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Plano Atual</p>
                  <p className="text-2xl font-bold text-black">{status.plan}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="flex gap-2 items-center mt-1">
                    <Badge
                      className="text-white"
                      style={{
                        backgroundColor:
                          status.status === "active"
                            ? "#00AA00"
                            : status.status === "trialing"
                            ? brandAccent
                            : "#ff6b6b",
                      }}
                    >
                      {status.status === "active"
                        ? "Ativo"
                        : status.status === "trialing"
                        ? "Trial"
                        : status.status}
                    </Badge>
                  </div>
                </div>

                {status.isTrialing && status.trialEndsAt && (
                  <div>
                    <p className="text-sm text-gray-600">Trial Expira Em</p>
                    <p className="font-semibold">
                      {new Date(status.trialEndsAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                )}

                {status.daysRemaining !== null && !status.isTrialing && (
                  <div>
                    <p className="text-sm text-gray-600">Dias Restantes</p>
                    <p className="text-lg font-semibold">{status.daysRemaining} dias</p>
                  </div>
                )}

                <Button
                  onClick={handleCancel}
                  disabled={cancelMut.isPending}
                  variant="destructive"
                  className="w-full"
                >
                  {cancelMut.isPending ? "Cancelando..." : "Cancelar Assinatura"}
                </Button>
              </CardContent>
            </Card>

            {/* Informações de Faturamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Próxima Cobrança</p>
                  <p className="text-xl font-bold text-black">
                    {status.daysRemaining ? (
                      <>
                        Em {status.daysRemaining} dias
                        <br />
                        <span className="text-sm font-normal text-gray-600">
                          {new Date(
                            Date.now() + (status.daysRemaining || 0) * 24 * 60 * 60 * 1000
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      </>
                    ) : (
                      "Sem cobrança agendada"
                    )}
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Método de Pagamento</p>
                  <p className="font-semibold text-black">Cartão de Crédito</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Gerenciado pelo Stripe
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  Alterar Método de Pagamento (em breve)
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-2 border-yellow-300 mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-black mb-2">Sem Assinatura Ativa</h3>
                  <p className="text-gray-600 mb-4">
                    Você não tem uma assinatura ativa no momento. Escolha um plano para começar.
                  </p>
                  <Button
                    className="text-black"
                    style={{ backgroundColor: brandAccent, color: brandAccentForeground }}
                    onClick={() => (window.location.href = "/planos")}
                  >
                    Ver Planos
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Faturas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Histórico de Faturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                Nenhuma fatura encontrada
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Data
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Valor
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice: any) => (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {new Date(invoice.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          R$ {(invoice.amount / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className="text-white"
                            style={{
                              backgroundColor:
                                invoice.status === "paid"
                                  ? "#00AA00"
                                  : invoice.status === "open"
                                  ? brandAccent
                                  : "#ff6b6b",
                            }}
                          >
                            {invoice.status === "paid"
                              ? "Pago"
                              : invoice.status === "open"
                              ? "Aberto"
                              : "Vencido"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {invoice.invoiceUrl ? (
                            <a
                              href={invoice.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Download className="w-4 h-4" />
                              Baixar
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="mt-8 bg-black text-white rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Perguntas Frequentes</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Como faço upgrade de plano?</h3>
              <p className="text-gray-300">
                Você pode fazer upgrade a qualquer momento acessando a página de planos. A mudança entrará em vigor no próximo ciclo de faturamento.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
              <p className="text-gray-300">
                Sim! Você pode cancelar sua assinatura a qualquer momento. O acesso será mantido até o final do período de faturamento atual.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Como obtenho uma nota fiscal?</h3>
              <p className="text-gray-300">
                Todas as faturas são enviadas por e-mail automaticamente e estão disponíveis para download nesta página.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
