import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderKanban, UserPlus, ListTodo, CheckCircle2,
  ArrowRight, X, Sparkles, ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    id: 1,
    icon: FolderKanban,
    title: "Crie seu primeiro projeto",
    description: "Projetos organizam tarefas, membros e entregas. Comece dando um nome ao seu projeto.",
    color: "#1561ad",
    bg: "bg-blue-50",
  },
  {
    id: 2,
    icon: UserPlus,
    title: "Convide um membro",
    description: "Colabore com sua equipe. Gere um link de convite para adicionar membros ao projeto.",
    color: "#1dbab4",
    bg: "bg-teal-50",
  },
  {
    id: 3,
    icon: ListTodo,
    title: "Crie sua primeira tarefa",
    description: "Tarefas são as unidades de trabalho. Adicione a primeira tarefa ao seu projeto.",
    color: "#fc5226",
    bg: "bg-orange-50",
  },
];

export default function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState(1);
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdTaskId, setCreatedTaskId] = useState<number | null>(null);

  // Step 1: Create project
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const createProjectMut = trpc.projects.create.useMutation({
    onSuccess: (data: any) => {
      setCreatedProjectId(data.id);
      utils.projects.list.invalidate();
      toast.success("Projeto criado com sucesso!");
      setStep(2);
    },
    onError: (e) => toast.error(e.message),
  });

  // Step 2: Generate invite link
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "viewer">("member");
  const createInviteMut = trpc.invites.create.useMutation({
    onSuccess: (data: any) => {
      const link = `${window.location.origin}/join?token=${data.token}`;
      setInviteLink(link);
      toast.success("Link de convite gerado!");
    },
    onError: (e) => toast.error(e.message),
  });

  // Step 3: Create task
  const [taskForm, setTaskForm] = useState({ title: "", description: "" });
  const createTaskMut = trpc.tasks.create.useMutation({
    onSuccess: (data: any) => {
      setCreatedTaskId(data.id);
      utils.tasks.list.invalidate();
      toast.success("Tarefa criada com sucesso!");
      setStep(4); // done
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreateProject() {
    if (!projectForm.name.trim()) { toast.error("Informe o nome do projeto."); return; }
    createProjectMut.mutate({ name: projectForm.name.trim(), description: projectForm.description.trim() || undefined });
  }

  function handleGenerateInvite() {
    if (!createdProjectId) return;
    createInviteMut.mutate({ projectId: createdProjectId, role: inviteRole, origin: window.location.origin });
  }

  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copiado!");
  }

  function handleCreateTask() {
    if (!taskForm.title.trim()) { toast.error("Informe o título da tarefa."); return; }
    if (!createdProjectId) return;
    createTaskMut.mutate({ projectId: createdProjectId, title: taskForm.title.trim(), description: taskForm.description.trim() || undefined, priority: "medium" });
  }

  function handleFinish() {
    onClose();
    if (createdProjectId) navigate(`/projects/${createdProjectId}/kanban`);
  }

  function handleSkip() {
    onClose();
  }

  const currentStep = STEPS.find((s) => s.id === step);
  const isDone = step === 4;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleSkip(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{ background: "linear-gradient(135deg, #1561ad 0%, #1c77ac 60%, #1dbab4 100%)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">Bem-vindo ao Orbita!</span>
            </div>
            <button
              onClick={handleSkip}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Progress dots */}
          {!isDone && (
            <div className="flex items-center gap-2">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s.id === step ? "w-8 bg-white" :
                    s.id < step ? "w-4 bg-white/60" :
                    "w-4 bg-white/25"
                  }`}
                />
              ))}
              <span className="text-white/70 text-xs ml-1">Passo {step} de 3</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Done state */}
          {isDone ? (
            <div className="flex flex-col items-center text-center py-4 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Tudo pronto!</h2>
                <p className="text-sm text-muted-foreground">
                  Seu projeto foi criado, o link de convite está disponível e a primeira tarefa já está no Kanban.
                </p>
              </div>
              <Button
                onClick={handleFinish}
                className="w-full gap-2"
                style={{ backgroundColor: "#1561ad" }}
              >
                Ir para o Kanban
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : currentStep ? (
            <div className="space-y-4">
              {/* Step icon + title */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${currentStep.bg}`}
                >
                  <currentStep.icon className="w-5 h-5" style={{ color: currentStep.color }} />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-base">{currentStep.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{currentStep.description}</p>
                </div>
              </div>

              {/* Step 1: Project form */}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome do projeto <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Ex: Projeto Rodovia BR-040"
                      value={projectForm.name}
                      onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Textarea
                      placeholder="Breve descrição do projeto..."
                      rows={2}
                      value={projectForm.description}
                      onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                      Pular configuração
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      style={{ backgroundColor: "#1561ad" }}
                      onClick={handleCreateProject}
                      disabled={createProjectMut.isPending}
                    >
                      {createProjectMut.isPending ? "Criando..." : "Criar Projeto"}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Invite link */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Função do convidado</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["member", "admin", "viewer"] as const).map((r) => {
                        const labels = { member: "Membro", admin: "Admin", viewer: "Visualizador" };
                        return (
                          <button
                            key={r}
                            onClick={() => setInviteRole(r)}
                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                              inviteRole === r
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {labels[r]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {inviteLink ? (
                    <div className="space-y-2">
                      <Label>Link gerado</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={inviteLink}
                          className="text-xs font-mono bg-secondary"
                        />
                        <Button variant="outline" size="sm" onClick={handleCopyLink}>
                          Copiar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Válido por 7 dias. Compartilhe com quem deseja convidar.</p>
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-2"
                      style={{ backgroundColor: "#1dbab4" }}
                      onClick={handleGenerateInvite}
                      disabled={createInviteMut.isPending}
                    >
                      {createInviteMut.isPending ? "Gerando..." : "Gerar Link de Convite"}
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="text-muted-foreground">
                      Pular este passo
                    </Button>
                    {inviteLink && (
                      <Button
                        className="flex-1 gap-2"
                        style={{ backgroundColor: "#1561ad" }}
                        onClick={() => setStep(3)}
                      >
                        Próximo passo
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Create task */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Título da tarefa <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Ex: Levantamento topográfico inicial"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateTask(); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Textarea
                      placeholder="Detalhes da tarefa..."
                      rows={2}
                      value={taskForm.description}
                      onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={handleFinish} className="text-muted-foreground">
                      Pular e ir ao Kanban
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      style={{ backgroundColor: "#fc5226" }}
                      onClick={handleCreateTask}
                      disabled={createTaskMut.isPending}
                    >
                      {createTaskMut.isPending ? "Criando..." : "Criar Tarefa"}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
