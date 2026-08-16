import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ArrowRight, Loader2, CheckCircle2, TriangleAlert, Building2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const token = new URLSearchParams(search).get("token") || "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: inviteInfo, isLoading: infoLoading, error: infoError } = trpc.auth.getInviteInfo.useQuery(
    { token },
    { enabled: Boolean(token), retry: false }
  );

  const acceptMutation = trpc.auth.acceptInvite.useMutation();

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) {
      toast.error("Preencha seu nome e defina uma senha forte.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await acceptMutation.mutateAsync({ token, name: name.trim(), password });
      if (res.success) {
        toast.success("Convite aceito com sucesso! Bem-vindo ao workspace.");
        window.location.href = "/dashboard";
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao aceitar convite";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-white space-y-4">
          <TriangleAlert className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-bold">Token de Convite Ausente</h1>
          <p className="text-sm text-slate-400">O link de convite utilizado é inválido ou está incompleto.</p>
          <Button onClick={() => navigate("/")} className="w-full bg-blue-600 hover:bg-blue-500 font-semibold">Ir para a página inicial</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 text-slate-100">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Convite para Workspace · Taskharbor</h1>
              <p className="text-xs opacity-90">Ingresse na equipe de forma segura</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {infoLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-xs text-slate-400">Verificando convite...</p>
            </div>
          ) : infoError || !inviteInfo || !inviteInfo.valid ? (
            <div className="py-8 text-center space-y-4">
              <TriangleAlert className="mx-auto h-12 w-12 text-rose-500" />
              <h2 className="text-base font-bold text-slate-200">Convite Inválido ou Expirado</h2>
              <p className="text-xs text-slate-400">{inviteInfo?.reason || infoError?.message || "Este link de convite expirou ou foi revogado pelo administrador."}</p>
              <Button onClick={() => navigate("/")} className="w-full bg-slate-800 hover:bg-slate-700 text-xs">Voltar ao início</Button>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-semibold">
                  <Building2 className="h-4 w-4" />
                  <span>{inviteInfo.companyName}</span>
                </div>
                <p className="text-slate-300">
                  Você foi convidado(a) para ingressar como <span className="font-semibold text-white uppercase">{inviteInfo.role}</span> utilizando o e-mail <span className="font-mono text-amber-300">{inviteInfo.email}</span>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-name" className="text-xs font-semibold text-slate-300">Seu Nome Completo</Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="Maria Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-password" className="text-xs font-semibold text-slate-300">Defina sua Senha (mín. 8 caracteres)</Label>
                <Input
                  id="invite-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Criando conta e ingressando..." : "Aceitar Convite e Entrar"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
