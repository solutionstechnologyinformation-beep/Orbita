import { useEffect, useRef, useState } from "react";
import * as QRCode from "qrcode";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MandatoryTfaSetup() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: false });
  const [token, setToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const setupStarted = useRef(false);

  const statusQ = trpc.tfa.status.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const setupMutation = trpc.tfa.setup.useMutation();
  const verifyMutation = trpc.tfa.verifyAndEnable.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !statusQ.data?.setupRequired || statusQ.data.enabled || setupStarted.current || qrCode) return;
    setupStarted.current = true;
    setupMutation.mutateAsync().then(async (data) => {
      setSecret(data.secret);
      setQrCode(await QRCode.toDataURL(data.otpauth, { width: 240, margin: 2 }));
    }).catch((error) => {
      setupStarted.current = false;
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o cadastro do 2FA.");
    });
  }, [isAuthenticated, qrCode, statusQ.data?.enabled, statusQ.data?.setupRequired]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !user.tfaSetupRequired && backupCodes.length === 0) {
      navigate("/dashboard");
    }
  }, [authLoading, backupCodes.length, isAuthenticated, navigate, user]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedToken = token.replace(/\D/g, "");
    if (normalizedToken.length !== 6) {
      toast.error("Informe o código de 6 dígitos exibido no aplicativo autenticador.");
      return;
    }

    try {
      const result = await verifyMutation.mutateAsync({ token: normalizedToken });
      setBackupCodes(result.backupCodes);
      await Promise.all([utils.auth.me.invalidate(), statusQ.refetch()]);
      toast.success("2FA configurado. Seu acesso ao workspace foi liberado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código TOTP inválido ou expirado.");
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Códigos de backup copiados.");
  };

  if (authLoading || !isAuthenticated || !user || statusQ.isLoading || (user.tfaSetupRequired && setupMutation.isPending && !qrCode)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" aria-hidden="true" />
          <p className="text-sm text-slate-300">Preparando seu cadastro obrigatório de segurança...</p>
        </div>
      </div>
    );
  }

  if (backupCodes.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 text-slate-100">
        <section className="w-full max-w-lg rounded-3xl border border-emerald-400/30 bg-slate-900/95 p-6 shadow-2xl sm:p-8" aria-labelledby="backup-title">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 id="backup-title" className="mt-4 text-center text-xl font-bold">2FA ativado com sucesso</h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-300">Guarde estes códigos em um local seguro. Cada código pode ser usado uma única vez quando você não tiver acesso ao aplicativo autenticador.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 font-mono text-sm text-amber-200 sm:grid-cols-4">
            {backupCodes.map((code) => <span key={code} className="rounded bg-slate-800/80 px-2 py-1 text-center">{code}</span>)}
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800" onClick={copyBackupCodes}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Copiar códigos
            </Button>
            <Button type="button" className="flex-1 bg-amber-400 font-semibold text-slate-950 hover:bg-amber-300" onClick={() => { window.location.href = "/dashboard"; }}>
              Acessar workspace <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 text-slate-100">
      <section className="w-full max-w-3xl rounded-3xl border border-amber-400/20 bg-slate-900/95 p-6 shadow-2xl sm:p-8" aria-labelledby="mandatory-tfa-title">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Primeiro acesso administrativo</p>
            <h1 id="mandatory-tfa-title" className="mt-1 text-2xl font-bold">Configure sua autenticação em duas etapas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Como você ingressou como administrador da empresa, esta configuração é obrigatória antes de acessar projetos, relatórios e dados do workspace.</p>
          </div>
        </div>

        <div className="mt-7 grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="rounded-2xl border border-slate-700 bg-white p-4 text-center">
            {qrCode ? <img src={qrCode} alt="QR Code para configurar o autenticador" className="mx-auto h-[220px] w-[220px]" /> : <div className="flex h-[220px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-500" aria-hidden="true" /></div>}
            <p className="mt-3 text-xs leading-5 text-slate-600">Escaneie o QR Code com Google Authenticator, Microsoft Authenticator ou outro aplicativo compatível.</p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-blue-400/20 bg-blue-950/30 p-4 text-sm leading-6 text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-blue-200"><KeyRound className="h-4 w-4" aria-hidden="true" /> Passo 1 · Vincule o autenticador</div>
              <p className="mt-1">Depois de escanear, digite o código temporário de 6 dígitos exibido pelo aplicativo.</p>
              {secret && <p className="mt-3 break-all font-mono text-xs text-amber-200">Chave manual: {secret}</p>}
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <Label htmlFor="mandatory-tfa-token" className="text-sm font-semibold text-slate-200">Código de confirmação</Label>
              <Input id="mandatory-tfa-token" value={token} onChange={(event) => setToken(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className="h-12 border-slate-700 bg-slate-950 text-center font-mono text-xl tracking-[0.35em] text-slate-100" disabled={verifyMutation.isPending || !qrCode} required />
              <Button type="submit" className="h-11 w-full bg-amber-400 font-semibold text-slate-950 hover:bg-amber-300" disabled={verifyMutation.isPending || !qrCode}>
                {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
                {verifyMutation.isPending ? "Validando configuração..." : "Ativar 2FA e continuar"}
              </Button>
            </form>

            <div className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <p>Após a confirmação, o Órbita exibirá códigos de backup de uso único. Salve-os antes de continuar.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
