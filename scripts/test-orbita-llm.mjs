import { getDb } from "../server/db.ts";
import { users } from "../drizzle/schema.ts";
import { processFloatingAgentCommand } from "../server/floating-agent.ts";
import { processOperationalAgentCommand } from "../server/operational-agent.ts";

const db = await getDb();
const [scope] = await db
  .select({ userId: users.id, companyId: users.companyId })
  .from(users)
  .orderBy(users.id)
  .limit(1);

if (!scope) {
  throw new Error("Nenhum usuário disponível para o smoke test.");
}

const generalResponse = await processFloatingAgentCommand(
  scope.userId,
  scope.companyId,
  "Explique em uma frase como você pode ajudar no Orbita."
);

const workloadResponse = await processOperationalAgentCommand(
  scope.userId,
  scope.companyId,
  "Avalie as demandas em aberto e sugira como distribuir entre a equipe e prazos."
);

const workloadRecommendations = workloadResponse.action.recommendations ?? [];
const workloadFallback = /temporariamente indisponível|não foi possível gerar/i.test(workloadResponse.reply);

console.log(JSON.stringify({
  tenantScoped: scope.companyId !== null,
  userScopedFallback: scope.companyId === null,
  generalConversation: {
    replyReceived: Boolean(generalResponse.reply?.trim()),
    actionType: generalResponse.action?.type ?? "none",
    replyLength: generalResponse.reply?.length ?? 0,
  },
  workloadAnalysis: {
    replyReceived: Boolean(workloadResponse.reply?.trim()),
    actionType: workloadResponse.action?.type ?? "none",
    recommendationsCount: workloadRecommendations.length,
    structuredRecommendations: workloadRecommendations.every((item) =>
      Number.isInteger(item.taskId)
      && Boolean(item.taskTitle)
      && Boolean(item.suggestedAssignee)
      && Boolean(item.suggestedDueDate)
      && Boolean(item.rationale)
    ),
    fallbackDetected: workloadFallback,
  },
}, null, 2));

process.exit(0);
