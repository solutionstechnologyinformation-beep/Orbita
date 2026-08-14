import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Camera, Palette, Save, X } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar, AvatarEditor } from "@/components/UserAvatar";
import AppLayout from "@/components/AppLayout";
import { getProfileFormValues } from "./profile-utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder",
  user: "Usuário",
};

export default function Profile() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(() => getProfileFormValues(user).name);
  const [company, setCompany] = useState(() => getProfileFormValues(user).company);
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? "#3b82f6");
  const [avatarInitials, setAvatarInitials] = useState(user?.avatarInitials ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "avatar">("info");

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
