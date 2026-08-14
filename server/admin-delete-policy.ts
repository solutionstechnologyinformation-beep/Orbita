import { TRPCError } from "@trpc/server";

export function assertCanDeleteUser(actorId: number, targetUserId: number, targetRole?: string | null) {
  if (targetUserId === actorId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover sua própria conta." });
  }
  if (targetRole === "master_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "O administrador principal não pode ser removido." });
  }
}
