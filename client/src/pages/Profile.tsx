import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import * as QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Camera, Palette, Save, X, Settings2, Clock3, ShieldCheck, KeyRound, Copy, RefreshCw, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar, AvatarEditor } from "@/components/UserAvatar";
import AppLayout from "@/components/AppLayout";
import { getProfileFormValues } from "./profile-utils";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getThemeTransitionDurationLabel,
  normalizeThemeTransitionDuration,
  THEME_TRANSITION_DURATION_OPTIONS,
} from "@/contexts/theme-utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder",
  user: "Usuário",
};

export default function Profile() {
  const { user } = useAuth();
  const { transitionDuration, setTransitionDuration } = useTheme();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(() => getProfileFormValues(user).name);
  const [company, setCompany] = useState(() => getProfileFormValues(user).company);
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? "#3b82f6");
  const [avatarInitials, setAvatarInitials] = useState(user?.avatarInitials ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "avatar" | "preferences" | "security">("info");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const canManageTfa = ["admin", "master_admin", "company_admin"].includes(user?.role ?? "");
  const tfaStatusQ = trpc.tfa.status.useQuery(undefined, { enabled: canManageTfa });
  const setupTfa = trpc.tfa.setup.useMutation();
  const verifyAndEnableTfa = trpc.tfa.verifyAndEnable.useMutation();
  const sendEmailTfa = trpc.tfa.sendEmailCode.useMutation();
  const verifyEmailTfa = trpc.tfa.verifyEmailAndEnable.useMutation();
  const disableTfa = trpc.tfa.disable.useMutation();
  const [tfaSecret, setTfaSecret] = useState("");
  const [tfaOtpAuth, setTfaOtpAuth] = useState("");
  const [tfaQrCode, setTfaQrCode] = useState("");
  const [tfaToken, setTfaToken] = useState("");
  const [tfaEmailToken, setTfaEmailToken] = useState("");
  const [tfaDisableToken, setTfaDisableToken] = useState("");
  const [tfaBackupCodes, setTfaBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncMotionPreference();
    mediaQuery.addEventListener?.("change", syncMotionPreference);
    return () => mediaQuery.removeEventListener?.("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const values = getProfileFormValues(user);
    setName(values.name);
    setCompany(values.company);
    setAvatarColor(user.avatarColor ?? "#3b82f6");
    setAvatarInitials(user.avatarInitials ?? "");
  }, [user?.id]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadAvatarPhoto = trpc.auth.uploadAvatarPhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada!");
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name: name.trim() || undefined, company: company.trim() || undefined });
  };

  const handleSaveAvatar = () => {
    updateProfile.mutate({ avatarColor, avatarInitials: avatarInitials || undefined });
  };

  const handleRemovePhoto = () => {
    updateProfile.mutate({ avatarUrl: "" });
  };

  const handleSetupTfa = async () => {
    try {
      const data = await setupTfa.mutateAsync();
      setTfaSecret(data.secret);
      setTfaOtpAuth(data.otpauth);
      setTfaBackupCodes([]);
      setTfaToken("");
      setTfaQrCode(await QRCode.toDataURL(data.otpauth, { width: 220, margin: 2 }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o 2FA.");
    }
  };

  const handleVerifyAndEnableTfa = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const data = await verifyAndEnableTfa.mutateAsync({ token: tfaToken.replace(/\\D/g, "") });
      setTfaBackupCodes(data.backupCodes);
      setTfaToken("");
      await tfaStatusQ.refetch();
      toast.success("Autenticação de dois fatores ativada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código TOTP inválido.");
    }
  };

  const handleSendEmailTfa = async () => {
    try {
      const result = await sendEmailTfa.mutateAsync();
      setTfaEmailToken("");
      toast.success(`Código enviado para ${result.maskedEmail}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o código por e-mail.");
    }
  };

  const handleVerifyEmailTfa = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await verifyEmailTfa.mutateAsync({ token: tfaEmailToken.replace(/\\D/g, "") });
      setTfaEmailToken("");
      await tfaStatusQ.refetch();
      toast.success("2FA por e-mail ativado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código de e-mail inválido.");
    }
  };

  const handleDisableTfa = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await disableTfa.mutateAsync({ token: tfaDisableToken.trim() });
      setTfaDisableToken("");
      setTfaSecret("");
      setTfaOtpAuth("");
      setTfaQrCode("");
      setTfaBackupCodes([]);
      await tfaStatusQ.refetch();
      toast.success("Autenticação de dois fatores desativada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código de verificação inválido.");
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(tfaBackupCodes.join("\\n"));
    toast.success("Códigos de recuperação copiados.");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadAvatarPhoto.mutateAsync({
          base64,
          mimeType: file.type,
          fileName: file.name,
        });
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (_err) {
      setUploadingPhoto(false);
    }
    // Reset input
    e.target.value = "";
  };

  // Preview user with current edits
  const previewUser = {
    name: name || user?.name,
    avatarUrl: user?.avatarUrl,
    avatarColor,
    avatarInitials,
  };

  return (
    <AppLayout title="Meu Perfil">
      <div className="container max-w-2xl py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative group">
            <UserAvatar user={previewUser} size="lg" className="!w-16 !h-16 !text-xl" />
            {user?.avatarUrl && (
              <button
                onClick={handleRemovePhoto}
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                title="Remover foto"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              Meu Perfil
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {user?.email ?? "—"} ·{" "}
              <Badge variant="secondary" className="text-xs">
                {ROLE_LABELS[user?.role ?? "user"] ?? user?.role}
              </Badge>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "info"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab("avatar")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "avatar"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Avatar
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "preferences"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Preferências
          </button>
          {canManageTfa && (
            <button
              onClick={() => setActiveTab("security")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "security"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Segurança
            </button>
          )}
        </div>

        {/* Tab: Informações */}
        {activeTab === "info" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveInfo} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Nome da sua empresa (opcional)"
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={user?.email ?? "—"} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">O e-mail é gerenciado pelo provedor de autenticação.</p>
                </div>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tab: Preferências */}
        {activeTab === "preferences" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Preferências de interface
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="theme-transition-duration" className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                  Duração da transição de tema
                </Label>
                <select
                  id="theme-transition-duration"
                  value={String(transitionDuration)}
                  onChange={(event) => setTransitionDuration?.(normalizeThemeTransitionDuration(event.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  aria-describedby="theme-transition-duration-help"
                >
                  {THEME_TRANSITION_DURATION_OPTIONS.map((duration) => (
                    <option key={duration} value={duration}>
                      {getThemeTransitionDurationLabel(duration)}
                    </option>
                  ))}
                </select>
                <p id="theme-transition-duration-help" className="text-xs text-muted-foreground">
                  A escolha é aplicada imediatamente e fica salva neste navegador para o seu usuário.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" role="status" aria-live="polite">
                {prefersReducedMotion
                  ? "O sistema solicitou movimento reduzido; a transição será exibida sem animação."
                  : `Transição atual: ${getThemeTransitionDurationLabel(transitionDuration)}.`}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab: Segurança */}
        {activeTab === "security" && canManageTfa && (
          <div className="space-y-4" aria-labelledby="security-title">
            <Card>
              <CardHeader>
                <CardTitle id="security-title" className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Autenticação de dois fatores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3" role="status" aria-live="polite">
                  <div>
                    <p className="font-medium">Status do 2FA</p>
                    <p className="text-xs text-muted-foreground">
                      {tfaStatusQ.isLoading
                        ? "Verificando configuração..."
                        : tfaStatusQ.data?.enabled
                          ? `Ativo por ${tfaStatusQ.data.method === "email" ? "e-mail" : "aplicativo autenticador"}.`
                          : "Ainda não ativado para este administrador."}
                    </p>
                  </div>
                  <Badge variant={tfaStatusQ.data?.enabled ? "default" : "secondary"}>
                    {tfaStatusQ.data?.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {!tfaStatusQ.data?.enabled && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                      <div className="mb-3 flex items-start gap-3">
                        <Mail className="mt-0.5 h-5 w-5 text-blue-700 dark:text-blue-300" />
                        <div>
                          <h3 className="font-semibold">Ativar por e-mail</h3>
                          <p className="text-sm text-muted-foreground">
                            Enviaremos um código de uso único para {tfaStatusQ.data?.email ?? "seu e-mail cadastrado"}.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" onClick={handleSendEmailTfa} disabled={sendEmailTfa.isPending || !tfaStatusQ.data?.emailConfigured}>
                          {sendEmailTfa.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          Enviar código por e-mail
                        </Button>
                        {!tfaStatusQ.data?.emailConfigured && <span className="text-xs text-amber-700">O Resend ainda não está configurado.</span>}
                      </div>
                      <form onSubmit={handleVerifyEmailTfa} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="w-full space-y-1 sm:max-w-[180px]">
                          <Label htmlFor="email-tfa-token">Código recebido</Label>
                          <Input id="email-tfa-token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={tfaEmailToken} onChange={(event) => setTfaEmailToken(event.target.value.replace(/\\D/g, ""))} placeholder="000000" aria-describedby="email-tfa-help" />
                          <p id="email-tfa-help" className="text-xs text-muted-foreground">Expira em 10 minutos.</p>
                        </div>
                        <Button type="submit" disabled={verifyEmailTfa.isPending || tfaEmailToken.length !== 6}>
                          {verifyEmailTfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmar e ativar
                        </Button>
                      </form>
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex items-start gap-3">
                        <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold">Aplicativo autenticador (TOTP)</h3>
                          <p className="text-sm text-muted-foreground">Alternativa offline com QR Code e códigos de recuperação.</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={handleSetupTfa} disabled={setupTfa.isPending}>
                        {setupTfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Configurar aplicativo
                      </Button>
                      {tfaQrCode && (
                        <div className="mt-4 space-y-3">
                          <img src={tfaQrCode} alt="QR Code para configurar o aplicativo autenticador" className="h-56 w-56 rounded border bg-white p-2" />
                          <p className="break-all text-xs text-muted-foreground">Chave manual: {tfaSecret}</p>
                          <form onSubmit={handleVerifyAndEnableTfa} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <div className="w-full space-y-1 sm:max-w-[180px]">
                              <Label htmlFor="totp-token">Código do aplicativo</Label>
                              <Input id="totp-token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={tfaToken} onChange={(event) => setTfaToken(event.target.value.replace(/\\D/g, ""))} placeholder="000000" />
                            </div>
                            <Button type="submit" disabled={verifyAndEnableTfa.isPending || tfaToken.length !== 6}>Confirmar TOTP</Button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tfaStatusQ.data?.enabled && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                    <h3 className="font-semibold">Desativar 2FA</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {tfaStatusQ.data.method === "email" ? "Solicite um novo código por e-mail e informe-o abaixo." : "Informe o código atual do seu aplicativo autenticador ou um código de recuperação."}
                    </p>
                    {tfaStatusQ.data.method === "email" && (
                      <Button type="button" variant="outline" size="sm" onClick={handleSendEmailTfa} disabled={sendEmailTfa.isPending} className="mb-3">
                        <Send className="mr-2 h-4 w-4" /> Enviar novo código
                      </Button>
                    )}
                    <form onSubmit={handleDisableTfa} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="w-full space-y-1 sm:max-w-[180px]">
                        <Label htmlFor="disable-tfa-token">Código de confirmação</Label>
                        <Input id="disable-tfa-token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={tfaDisableToken} onChange={(event) => setTfaDisableToken(event.target.value.replace(/\\D/g, ""))} placeholder="000000" />
                      </div>
                      <Button type="submit" variant="destructive" disabled={disableTfa.isPending || tfaDisableToken.length < 6}>
                        {disableTfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Desativar 2FA
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Avatar */}
        {activeTab === "avatar" && (
          <div className="space-y-4">
            {/* Upload de foto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  Foto de Perfil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <UserAvatar user={previewUser} size="lg" className="!w-16 !h-16 !text-xl" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Envie uma foto (JPG, PNG ou WebP, máx. 5 MB). A foto tem prioridade sobre cor e iniciais.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto || uploadAvatarPhoto.isPending}
                      >
                        {uploadingPhoto || uploadAvatarPhoto.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-2" />
                        )}
                        {user?.avatarUrl ? "Trocar foto" : "Enviar foto"}
                      </Button>
                      {user?.avatarUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemovePhoto}
                          disabled={updateProfile.isPending}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editor de cor e iniciais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  Cor e Iniciais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Usado quando não há foto de perfil.
                </p>
                <AvatarEditor
                  value={{ avatarColor, avatarInitials }}
                  onChange={({ avatarColor: c, avatarInitials: i }) => {
                    setAvatarColor(c);
                    setAvatarInitials(i);
                  }}
                  name={user?.name}
                />
                <Button
                  type="button"
                  onClick={handleSaveAvatar}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Avatar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
