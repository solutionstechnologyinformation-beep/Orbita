import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import BrandingDashboardPreview from "@/components/BrandingDashboardPreview";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { PasswordVisibilityToggle } from "@/components/PasswordVisibilityToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertCircle, Building2, CheckCircle2, FolderKanban, KeyRound, Loader2, Plus, ShieldCheck, UserPlus, Users, Settings, Upload } from "lucide-react";
import { FormEvent, useState, useEffect } from "react";
import { CompanyInvitesSection } from "./CompanyInvitesSection";

const roleLabels: Record<string, string> = {
  user: "Usuário",
  leader: "Líder",
  company_admin: "Admin da empresa",
};

export default function CompanyAdmin() {
  const { user } = useAuth();
  const canAccess = user?.role === "company_admin" || user?.role === "admin" || user?.role === "master_admin";
  const utils = trpc.useUtils();
  const dashboard = trpc.companyAdmin.dashboard.useQuery(undefined, { enabled: canAccess, staleTime: 30_000 });
  const passwordPolicy = trpc.companyAdmin.passwordPolicy.get.useQuery(undefined, { enabled: canAccess, staleTime: 30_000 });
  const createUser = trpc.companyAdmin.createUser.useMutation({
    onSuccess: async () => {
      await utils.companyAdmin.dashboard.invalidate();
      setForm({ name: "", email: "", password: "", role: "user" });
      toast.success("Usuário criado dentro da empresa.");
    },
    onError: (error) => toast.error(error.message),
  });
  const [brandingSaveState, setBrandingSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [brandingFeedback, setBrandingFeedback] = useState("");
  const [passwordPolicyForm, setPasswordPolicyForm] = useState({ minLength: 8, requireUppercase: false, requireNumber: true, requireSpecial: false });
  const [passwordPolicyFeedback, setPasswordPolicyFeedback] = useState("");
  const [showAdminUserPassword, setShowAdminUserPassword] = useState(false);
  const updatePasswordPolicy = trpc.companyAdmin.passwordPolicy.update.useMutation({
    onSuccess: (policy) => {
      setPasswordPolicyForm(policy);
      setPasswordPolicyFeedback("Política de senha salva e aplicada aos próximos cadastros e convites.");
      void utils.companyAdmin.passwordPolicy.get.invalidate();
      toast.success("Política de senha atualizada.");
    },
    onError: (error) => {
      setPasswordPolicyFeedback(error.message);
      toast.error(error.message);
    },
  });

  const updateRole = trpc.companyAdmin.updateUserRole.useMutation({
    onSuccess: () => { void utils.companyAdmin.dashboard.invalidate(); toast.success("Permissão atualizada."); },
    onError: (error) => toast.error(error.message),
  });
  const archiveProject = trpc.companyAdmin.archiveProject.useMutation({
    onSuccess: () => { void utils.companyAdmin.dashboard.invalidate(); toast.success("Projeto arquivado."); },
    onError: (error) => toast.error(error.message),
  });
  const updateBranding = trpc.companyAdmin.updateBranding.useMutation({
    onSuccess: () => {
      void utils.companyAdmin.dashboard.invalidate();
      setBrandingSaveState("success");
      setBrandingFeedback("Branding salvo com sucesso. A nova identidade já está ativa para a empresa.");
      toast.success("Configurações de branding atualizadas.");
    },
    onError: (error) => {
      setBrandingSaveState("error");
      setBrandingFeedback(`Não foi possível salvar o branding: ${error.message}`);
      toast.error(error.message);
    },
  });
  const uploadLogo = trpc.companyAdmin.uploadLogo.useMutation({
    onError: (error) => {
      setBrandingSaveState("error");
      setBrandingFeedback(`Não foi possível enviar a logo: ${error.message}`);
      toast.error(error.message);
    },
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as "user" | "leader" | "company_admin" });
  const [brandingForm, setBrandingForm] = useState({ name: "", color: "#2563eb", logoUrl: "", logoDarkUrl: "" });
  const [pendingLogos, setPendingLogos] = useState<{ light?: { base64: string; mimeType: string; fileName: string }; dark?: { base64: string; mimeType: string; fileName: string } }>({});
  const updateBrandingField = (field: keyof typeof brandingForm, value: string) => {
    setBrandingForm((current) => ({ ...current, [field]: value }));
    setBrandingSaveState("idle");
    setBrandingFeedback("");
  };

  useEffect(() => {
    if (passwordPolicy.data) {
      setPasswordPolicyForm(passwordPolicy.data);
    }
  }, [passwordPolicy.data]);

  useEffect(() => {
    if (dashboard.data?.company) {
      setBrandingForm({
        name: dashboard.data.company.name ?? "",
        color: dashboard.data.company.color ?? "#2563eb",
        logoUrl: dashboard.data.company.logoUrl ?? "",
        logoDarkUrl: dashboard.data.company.logoDarkUrl ?? "",
      });
      setPendingLogos({});
    }
  }, [dashboard.data?.company]);

  const handleBrandingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBrandingSaveState("saving");
    setBrandingFeedback("Salvando as configurações de branding e preparando a nova identidade...");
    try {
      const uploaded = { logoUrl: brandingForm.logoUrl || null, logoDarkUrl: brandingForm.logoDarkUrl || null };
      if (pendingLogos.light) {
        const result = await uploadLogo.mutateAsync({ ...pendingLogos.light, variant: "light" });
        uploaded.logoUrl = result.url;
      }
      if (pendingLogos.dark) {
        const result = await uploadLogo.mutateAsync({ ...pendingLogos.dark, variant: "dark" });
        uploaded.logoDarkUrl = result.url;
      }
      await updateBranding.mutateAsync({ name: brandingForm.name, color: brandingForm.color, ...uploaded });
      setPendingLogos({});
    } catch {
      setBrandingSaveState("error");
      setBrandingFeedback("Não foi possível concluir o salvamento. Revise os dados e tente novamente.");
      // As mutações exibem o erro via onError; preservamos o preview para nova tentativa.
    }
  };

  const handleLogoUpload = (file: File, variant: "light" | "dark") => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) return;
      updateBrandingField(variant === "dark" ? "logoDarkUrl" : "logoUrl", result);
      setPendingLogos((current) => ({ ...current, [variant]: { base64, mimeType: file.type || "image/png", fileName: file.name } }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createUser.mutate(form);
  };

  const handlePasswordPolicySubmit = (event: FormEvent) => {
    event.preventDefault();
    setPasswordPolicyFeedback("");
    updatePasswordPolicy.mutate(passwordPolicyForm);
  };

  if (!canAccess) {
    return <AppLayout title="Admin da empresa"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Você não possui permissão para acessar este painel.</div></AppLayout>;
  }

  const data = dashboard.data;
  return (
    <AppLayout title="Admin da empresa">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Gestão por empresa</p>
              <h1 className="text-2xl font-black tracking-tight">{data?.company.name ?? "Carregando empresa..."}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Administre usuários, permissões e contratos sem acessar dados de outras empresas.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur-sm"><p className="text-[10px] uppercase tracking-wide text-slate-400">Identificador</p><p className="font-mono text-sm text-emerald-200">{data?.company.slug ?? "—"}</p></div>
          </div>
        </header>

        {dashboard.isLoading ? <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dados da empresa...</div> : dashboard.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{dashboard.error.message}</div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard icon={<Users className="h-5 w-5" />} label="Usuários" value={data?.members.length ?? 0} />
              <SummaryCard icon={<FolderKanban className="h-5 w-5" />} label="Projetos ativos" value={data?.projects.filter((project: any) => project.status === "active").length ?? 0} />
              <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Administradores" value={data?.members.filter((member: any) => member.role === "company_admin").length ?? 0} />
            </div>

            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid h-auto w-full max-w-3xl grid-cols-4 rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="users" className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
                <TabsTrigger value="invites" className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><UserPlus className="h-4 w-4" /> Convites</TabsTrigger>
                <TabsTrigger value="projects" className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><FolderKanban className="h-4 w-4" /> Projetos</TabsTrigger>
                <TabsTrigger value="settings" className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="mt-4">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Usuários da empresa</h2><p className="text-xs text-slate-500">As alterações ficam restritas ao companyId desta organização.</p></div><Users className="h-5 w-5 text-emerald-600" /></div>
                    <div className="divide-y divide-slate-100">
                      {data?.members.map((member: any) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{member.name || "Sem nome"}</p><p className="truncate text-xs text-slate-500">{member.email || "Sem e-mail"}</p></div><div className="flex items-center gap-2"><select value={member.role} onChange={(event) => updateRole.mutate({ userId: member.id, role: event.target.value as "user" | "leader" | "company_admin" })} disabled={updateRole.isPending || member.id === user?.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"><option value="user">{roleLabels.user}</option><option value="leader">{roleLabels.leader}</option><option value="company_admin">{roleLabels.company_admin}</option></select><Badge variant="outline" className="hidden sm:inline-flex">{member.lastSeenAt ? "Presença registrada" : "Sem presença"}</Badge></div></div>)}
                      {data?.members.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhum usuário vinculado à empresa.</p>}
                    </div>
                  </section>

                  <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><UserPlus className="h-4 w-4" /></div><div><h2 className="font-bold text-slate-900">Novo usuário</h2><p className="text-xs text-slate-500">Será vinculado automaticamente à empresa.</p></div></div><div className="space-y-3"><div><Label htmlFor="company-user-name">Nome</Label><Input id="company-user-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></div><div><Label htmlFor="company-user-email">E-mail</Label><Input id="company-user-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></div><div><Label htmlFor="company-user-password">Senha inicial</Label><div className="relative"><Input id="company-user-password" type={showAdminUserPassword ? "text" : "password"} minLength={passwordPolicy.data?.minLength ?? 8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" className="pr-10" required /><PasswordVisibilityToggle visible={showAdminUserPassword} onToggle={() => setShowAdminUserPassword((visible) => !visible)} inputId="company-user-password" /></div><PasswordStrengthIndicator password={form.password} policy={passwordPolicy.data ?? undefined} /><p className="mt-1 text-[11px] text-slate-500">Mínimo de {passwordPolicy.data?.minLength ?? 8} caracteres{passwordPolicy.data?.requireUppercase ? ", uma maiúscula" : ""}{passwordPolicy.data?.requireNumber ? ", um número" : ""}{passwordPolicy.data?.requireSpecial ? " e um caractere especial" : ""}.</p></div><div><Label htmlFor="company-user-role">Permissão</Label><select id="company-user-role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as typeof current.role }))} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="user">{roleLabels.user}</option><option value="leader">{roleLabels.leader}</option><option value="company_admin">{roleLabels.company_admin}</option></select></div><Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={createUser.isPending}><Plus className="mr-2 h-4 w-4" />{createUser.isPending ? "Criando..." : "Criar usuário"}</Button></div></form>
                </div>
              </TabsContent>

              <TabsContent value="invites" className="mt-4">
                <CompanyInvitesSection />
              </TabsContent>

              <TabsContent value="projects" className="mt-4">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Projetos da empresa</h2><p className="text-xs text-slate-500">Somente contratos vinculados ao companyId atual são exibidos.</p></div><Building2 className="h-5 w-5 text-emerald-600" /></div><div className="grid gap-3 p-5 md:grid-cols-2">{data?.projects.map((project: any) => <div key={project.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{project.name}</p><p className="mt-1 text-xs text-slate-500">{project.code || project.clientName || "Sem código"}</p></div><Badge className={project.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{project.status === "active" ? "Ativo" : "Arquivado"}</Badge></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(project.progress) || 0))}%` }} /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{Number(project.progress || 0).toLocaleString("pt-BR")}% concluído</span>{project.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => { if (window.confirm(`Arquivar o projeto ${project.name}?`)) archiveProject.mutate({ crsId: project.id }); }} disabled={archiveProject.isPending}>Arquivar</Button>}</div></div>)}{data?.projects.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">Nenhum projeto vinculado à empresa.</p>}</div></section>
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <form onSubmit={handleBrandingSubmit} aria-busy={brandingSaveState === "saving"} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Settings className="h-5 w-5 text-emerald-600" />
                      <div>
                        <h2 className="font-bold text-slate-900">Branding da Empresa</h2>
                        <p className="text-xs text-slate-500">Personalize o nome e as logomarcas exibidas na plataforma.</p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="company-name-input">Nome da Empresa</Label>
                      <Input
                        id="company-name-input"
                        value={brandingForm.name}
                        onChange={(e) => updateBrandingField("name", e.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-color-input">Cor principal</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input id="company-color-input" type="color" value={brandingForm.color} onChange={(e) => updateBrandingField("color", e.target.value)} className="h-10 w-14 cursor-pointer p-1" aria-label="Selecionar cor principal da empresa" />
                        <Input value={brandingForm.color} onChange={(e) => updateBrandingField("color", e.target.value)} pattern="^#[0-9a-fA-F]{6}$" aria-label="Código hexadecimal da cor principal" className="font-mono" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="logo-url-input">URL da Logo (Tema Claro)</Label>
                      <Input
                        id="logo-url-input"
                        value={brandingForm.logoUrl}
                        onChange={(e) => updateBrandingField("logoUrl", e.target.value)}
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="logo-dark-url-input">URL da Logo (Tema Escuro / Transparente)</Label>
                      <Input
                        id="logo-dark-url-input"
                        value={brandingForm.logoDarkUrl}
                        onChange={(e) => updateBrandingField("logoDarkUrl", e.target.value)}
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                    <div aria-live="polite" aria-atomic="true" className={`min-h-10 rounded-lg border px-3 py-2 text-xs transition-[opacity,transform,background-color,border-color] duration-300 ease-out motion-reduce:transition-none ${brandingSaveState === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : brandingSaveState === "error" ? "border-red-200 bg-red-50 text-red-800" : brandingSaveState === "saving" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-transparent bg-transparent text-transparent"}`}>
                      {brandingSaveState !== "idle" && <span className="flex items-center gap-2">
                        {brandingSaveState === "saving" && <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                        {brandingSaveState === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        {brandingSaveState === "error" && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        <span>{brandingFeedback}</span>
                      </span>}
                    </div>
                    <Button type="submit" className="w-full bg-emerald-600 transition-[transform,background-color,box-shadow] duration-300 ease-out hover:bg-emerald-700 hover:shadow-md active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none" disabled={updateBranding.isPending || uploadLogo.isPending}>
                      {brandingSaveState === "saving" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Salvando...</> : brandingSaveState === "success" ? <><CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" /> Branding salvo</> : "Salvar alterações de branding"}
                    </Button>
                  </form>

                  <div className="space-y-6">
                    <form onSubmit={handlePasswordPolicySubmit} aria-busy={updatePasswordPolicy.isPending} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><KeyRound className="h-5 w-5" aria-hidden="true" /></div>
                        <div>
                          <h2 className="font-bold text-slate-900">Política de senha</h2>
                          <p className="text-xs leading-5 text-slate-500">Defina os requisitos mínimos aplicados a novos cadastros, usuários criados pela administração e convites desta empresa.</p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="password-policy-min-length">Quantidade mínima de caracteres</Label>
                        <Input id="password-policy-min-length" type="number" min={8} max={128} value={passwordPolicyForm.minLength} onChange={(event) => setPasswordPolicyForm((current) => ({ ...current, minLength: Number(event.target.value) || 8 }))} className="mt-1" />
                        <p className="mt-1 text-[11px] text-slate-500">O mínimo permitido é 8 e o máximo é 128 caracteres.</p>
                      </div>
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium text-slate-700">Requisitos adicionais</legend>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                          <input type="checkbox" checked={passwordPolicyForm.requireUppercase} onChange={(event) => setPasswordPolicyForm((current) => ({ ...current, requireUppercase: event.target.checked }))} className="h-4 w-4 accent-emerald-600" />
                          Pelo menos uma letra maiúscula
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                          <input type="checkbox" checked={passwordPolicyForm.requireNumber} onChange={(event) => setPasswordPolicyForm((current) => ({ ...current, requireNumber: event.target.checked }))} className="h-4 w-4 accent-emerald-600" />
                          Pelo menos um número
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                          <input type="checkbox" checked={passwordPolicyForm.requireSpecial} onChange={(event) => setPasswordPolicyForm((current) => ({ ...current, requireSpecial: event.target.checked }))} className="h-4 w-4 accent-emerald-600" />
                          Pelo menos um caractere especial
                        </label>
                      </fieldset>
                      <div aria-live="polite" className={`rounded-lg border px-3 py-2 text-xs ${passwordPolicyFeedback.includes("salva") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : passwordPolicyFeedback ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {passwordPolicyFeedback || `Exemplo de regra atual: ${passwordPolicyForm.minLength} caracteres${passwordPolicyForm.requireUppercase ? ", uma maiúscula" : ""}${passwordPolicyForm.requireNumber ? ", um número" : ""}${passwordPolicyForm.requireSpecial ? " e um caractere especial" : ""}.`}
                      </div>
                      <Button type="submit" className="w-full bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400" disabled={updatePasswordPolicy.isPending || passwordPolicy.isLoading}>
                        {updatePasswordPolicy.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Salvando política...</> : <><KeyRound className="mr-2 h-4 w-4" aria-hidden="true" /> Salvar política de senha</>}
                      </Button>
                    </form>

                    <BrandingDashboardPreview values={brandingForm} onReset={() => {
                      const company = data?.company;
                      if (!company) return;
                      setBrandingForm({ name: company.name ?? "", color: company.color ?? "#2563eb", logoUrl: company.logoUrl ?? "", logoDarkUrl: company.logoDarkUrl ?? "" });
                      setPendingLogos({});
                      setBrandingSaveState("idle");
                      setBrandingFeedback("");
                    }} />
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Upload className="h-5 w-5 text-emerald-600" />
                        <div>
                          <h3 className="font-bold text-slate-900">Upload de Logomarca (Modo Claro)</h3>
                          <p className="text-xs text-slate-500">Envie uma imagem PNG, JPG ou SVG (máx. 5MB).</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {brandingForm.logoUrl && (
                          <div className="h-14 w-14 rounded-lg border border-slate-200 bg-slate-50 p-1 flex items-center justify-center">
                            <img src={brandingForm.logoUrl} alt="Logo clara" className="h-full w-full object-contain" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, "light");
                          }}
                          disabled={uploadLogo.isPending || updateBranding.isPending}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Upload className="h-5 w-5 text-emerald-600" />
                        <div>
                          <h3 className="font-bold text-slate-900">Upload de Logomarca (Modo Escuro)</h3>
                          <p className="text-xs text-slate-500">Envie a versão com desenho branco ou transparente (máx. 5MB).</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {brandingForm.logoDarkUrl && (
                          <div className="h-14 w-14 rounded-lg border border-slate-700 bg-slate-900 p-1 flex items-center justify-center">
                            <img src={brandingForm.logoDarkUrl} alt="Logo escura" className="h-full w-full object-contain" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, "dark");
                          }}
                          disabled={uploadLogo.isPending || updateBranding.isPending}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{icon}</span><span className="text-2xl font-black text-slate-900">{value}</span></div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p></div>;
}
