import { getDb, getProjectMembers } from "./db";
import { tasks, agendaEvents, crs, kanbanPhases, users } from "../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

  export type AgentOperationalAction = {
    type: "navigate" | "map_focus" | "map_filter_state" | "map_highlight_contract" | "generate_report_pdf" | "map_export_csv" | "map_toggle_layer" | "analyze_workload" | "ask_clarification" | "search" | "agenda" | "none";
    targetUrl?: string;
    region?: string; // ex: "Goiás", "MG", "SP"
    contractName?: string;
    period?: string; // ex: "agosto", "2026", "julho"
    reportType?: string; // ex: "dashboard", "complete", "annual"
    layerType?: string; // ex: "satellite" | "roadmap"
    clarificationPrompt?: string;
    searchTerm?: string;
    recommendations?: Array<{
      taskId: number;
      taskTitle: string;
      suggestedAssignee: string;
      suggestedDueDate: string;
      rationale: string;
    }>;
  };

export type AgentOperationalResponse = {
  reply: string;
  action: AgentOperationalAction;
  requiresClarification?: boolean;
}

async function getMembersForUser(userId: number) {
  const allMembers = await getProjectMembers();
  return allMembers.filter((member: { id: number }) => member.id === userId);
}

async function buildWorkloadAnalysis(userId: number, companyId: number | null): Promise<AgentOperationalResponse> {
  const db = await getDb();
  const scope = companyId != null ? eq(crs.companyId, companyId) : eq(tasks.createdById, userId);
  const openTasks = await db.select({
    id: tasks.id,
    title: tasks.title,
    description: tasks.description,
    priority: tasks.priority,
    assigneeId: tasks.assigneeId,
    assigneeName: users.name,
    dueDate: tasks.dueDate,
    startDate: tasks.startDate,
    setor: tasks.setor,
    progress: tasks.progress,
    phaseName: kanbanPhases.name,
    crsName: crs.name,
  })
    .from(tasks)
    .innerJoin(crs, eq(tasks.crsId, crs.id))
    .innerJoin(kanbanPhases, eq(tasks.phaseId, kanbanPhases.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(scope, eq(kanbanPhases.isTerminal, false)))
    .orderBy(desc(tasks.priority), tasks.dueDate)
    .limit(100);
  const members = companyId != null
    ? await getProjectMembers(companyId)
    : await getMembersForUser(userId);

  if (openTasks.length === 0) {
    return {
      reply: "Não encontrei demandas abertas no espaço da sua empresa. Posso analisar novas tarefas assim que forem cadastradas.",
      action: { type: "analyze_workload", targetUrl: "/kanban" },
    };
  }

  const taskContext = openTasks.map((task: typeof openTasks[number]) => ({
    id: task.id,
    title: task.title,
    description: task.description?.slice(0, 500) ?? "",
    priority: task.priority,
    assignee: task.assigneeName ?? "Não atribuído",
    dueDate: task.dueDate?.toISOString() ?? null,
    startDate: task.startDate?.toISOString() ?? null,
    discipline: task.setor ?? "Não informado",
    progress: task.progress,
    phase: task.phaseName,
    project: task.crsName,
  }));
  const memberContext = members.map((member: typeof members[number]) => ({
    id: member.id,
    name: member.name ?? `Usuário ${member.id}`,
    role: member.role,
    disciplines: member.disciplines,
  }));

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é um gerente de operações do Orbita. Analise somente os dados fornecidos, não invente pessoas, tarefas ou disponibilidade. Sugira distribuição e prazos como recomendação, nunca altere tarefas automaticamente. Considere prioridade, disciplina, progresso, responsável atual e data de entrega. Responda em JSON válido.",
        },
        {
          role: "user",
          content: `Demandas abertas: ${JSON.stringify(taskContext)}\nEquipe disponível no tenant: ${JSON.stringify(memberContext)}\nCrie uma avaliação objetiva com recomendações executáveis e prazos sugeridos em formato ISO (YYYY-MM-DD).`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "workload_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taskId: { type: "integer" },
                    taskTitle: { type: "string" },
                    suggestedAssignee: { type: "string" },
                    suggestedDueDate: { type: "string" },
                    rationale: { type: "string" },
                  },
                  required: ["taskId", "taskTitle", "suggestedAssignee", "suggestedDueDate", "rationale"],
                  additionalProperties: false,
                },
              },
            },
            required: ["summary", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const recommendations = Array.isArray(parsed?.recommendations) ? parsed.recommendations.slice(0, 20) : [];
    const lines = recommendations.map((item: any, index: number) => `${index + 1}. #${item.taskId} ${item.taskTitle}: ${item.suggestedAssignee} até ${item.suggestedDueDate}. ${item.rationale}`);
    return {
      reply: `${parsed?.summary ?? "Analisei as demandas abertas."}\n\n${lines.length > 0 ? lines.join("\n") : "Não foi possível gerar recomendações específicas com os dados atuais."}`,
      action: {
        type: "analyze_workload",
        targetUrl: "/kanban",
        recommendations,
      },
    };
  } catch {
    const unassigned = openTasks.filter((task: typeof openTasks[number]) => task.assigneeId == null).length;
    return {
      reply: `Encontrei ${openTasks.length} demandas abertas, sendo ${unassigned} sem responsável. Posso abrir o Kanban para você revisar a distribuição; a análise detalhada da IA está temporariamente indisponível.`,
      action: { type: "analyze_workload", targetUrl: "/kanban" },
    };
  }
}

export async function processOperationalAgentCommand(
  userId: number,
  companyId: number | null,
  userMessage: string,
  currentScreenContext?: { route?: string; activeState?: string; visibleContracts?: string[] }
): Promise<AgentOperationalResponse> {
  const db = await getDb();
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  // 1. Avaliar demandas abertas sem alterar tarefas automaticamente.
  if (/(demandas?.*(aberta|equipe|prazo|distribui|analis)|tarefas?.*(aberta|equipe|prazo|distribui|analis)|avaliar.*demandas?|analisar.*demandas?|distribuir.*(equipe|tarefas?))/.test(lower)) {
    return buildWorkloadAnalysis(userId, companyId);
  }

  // 2A. Verificar comandos de exportar dados do mapa em formato CSV ("exportar mapa em csv", "baixar csv do mapa")
  if (lower.includes("csv") || (lower.includes("exportar") && lower.includes("mapa"))) {
    return {
      reply: "Certo! Iniciando a exportação dos dados e trechos visíveis do mapa em formato CSV pelo painel lateral.",
      action: {
        type: "map_export_csv",
        targetUrl: "/dashboard",
      },
    };
  }

  // 2B. Verificar comandos de alternância de camadas de mapa ("modo satélite", "visão satélite", "mapa padrão", "mapa de estrada")
  if (lower.includes("satélite") || lower.includes("satelite") || (lower.includes("camada") && lower.includes("satélite"))) {
    return {
      reply: "Alternando a visualização do mapa para o modo Satélite.",
      action: {
        type: "map_toggle_layer",
        targetUrl: "/dashboard",
        layerType: "satellite",
      },
    };
  }

  if (lower.includes("mapa padrão") || lower.includes("mapa normal") || lower.includes("padrão") || lower.includes("roadmap")) {
    return {
      reply: "Alternando a visualização do mapa para o modo Padrão.",
      action: {
        type: "map_toggle_layer",
        targetUrl: "/dashboard",
        layerType: "roadmap",
      },
    };
  }

  // 2C. Verificar comandos diretos de mapa (ex: "mostrar no mapa trechos de Goiás", "zoom em Goiás", "focar em MG")
  if (lower.includes("mapa") && (lower.includes("goiás") || lower.includes("goias") || lower.includes("mg") || lower.includes("são paulo") || lower.includes("sp") || lower.includes("ampliado"))) {
    const region = lower.includes("goiás") || lower.includes("goias") ? "Goiás" : lower.includes("mg") ? "Minas Gerais" : lower.includes("sp") || lower.includes("são paulo") ? "São Paulo" : "Goiás";
    
    // Buscar contratos visíveis nesta região no banco
    const allCrs = await db.select({ name: crs.name, state: crs.state }).from(crs).where(companyId != null ? eq(crs.companyId, companyId) : eq(crs.createdById, userId));
    const matching = allCrs.filter((c: any) => (c.state && c.state.toLowerCase().includes(region.toLowerCase())) || (c.name && c.name.toLowerCase().includes(region.toLowerCase())));
    const contractNames = matching.map((m: any) => m.name);

    if (contractNames.length > 0) {
      return {
        reply: `Certo! Ampliando o mapa para os trechos em ${region}. Encontrei ${contractNames.length} contrato(s) nesta região: ${contractNames.slice(0, 3).join(", ")}. Qual dos contratos deste visual você deseja destacar ou ver os detalhes?`,
        action: {
          type: "map_focus",
          targetUrl: "/dashboard",
          region,
          contractName: contractNames[0],
        },
        requiresClarification: true,
      };
    } else {
      return {
        reply: `Ampliando o mapa para ${region}. Deseja que eu filtre os contratos por este estado ou prefere ver o relatório completo?`,
        action: {
          type: "map_focus",
          targetUrl: "/dashboard",
          region,
        },
        requiresClarification: false,
      };
    }
  }

  // 3. Verificar comandos diretos de PDF / relatório por período (ex: "gerar relatório em PDF de agosto", "relatório do mês de agosto")
  if (lower.includes("relatório") && (lower.includes("pdf") || lower.includes("gerar") || lower.includes("exportar")) && (lower.includes("agosto") || lower.includes("julho") || lower.includes("mês") || lower.includes("ano") || lower.includes("2026"))) {
    const periodMatch = lower.includes("agosto") ? "Agosto" : lower.includes("julho") ? "Julho" : lower.includes("setembro") ? "Setembro" : "Agosto";
    return {
      reply: `Entendido! Iniciando a geração e exportação do relatório em PDF completo para o período de ${periodMatch} com o mapa e dados atualizados.`,
      action: {
        type: "generate_report_pdf",
        targetUrl: "/relatorios",
        period: periodMatch,
        reportType: "complete",
      },
    };
  }

  // 4. Verificar comandos de destaque de contrato (ex: "destacar o contrato X", "mostrar contrato BH Shopping")
  if (lower.includes("destacar contrato") || lower.includes("contrato") || lower.includes("destacar")) {
    const contractQuery = trimmed.replace(/^(destacar contrato|contrato|destacar|mostrar contrato)\s*/i, "").trim();
    if (contractQuery.length > 2) {
      return {
        reply: `Aplicando foco e destaque no contrato "${contractQuery}" no mapa e painel de controle.`,
        action: {
          type: "map_highlight_contract",
          targetUrl: "/dashboard",
          contractName: contractQuery,
        },
      };
    }
  }

  // 4. Fallback para LLM operacional avançada com contexto completo do sistema
  const [recentTasks, upcomingAgenda, projects] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, priority: tasks.priority }).from(tasks).innerJoin(crs, eq(tasks.crsId, crs.id)).where(companyId != null ? eq(crs.companyId, companyId) : eq(tasks.createdById, userId)).orderBy(desc(tasks.createdAt)).limit(10),
    db.select({ id: agendaEvents.id, title: agendaEvents.title, startDate: agendaEvents.startDate }).from(agendaEvents).where(eq(agendaEvents.createdById, userId)).orderBy(agendaEvents.startDate).limit(5),
    db.select({ id: crs.id, name: crs.name, state: crs.state }).from(crs).where(companyId != null ? eq(crs.companyId, companyId) : eq(crs.createdById, userId)).limit(15),
  ]);

  const systemPrompt = `Você é o Agente Operacional Avançado do Orbita (LS Solutions).
Você tem controle total do sistema via comandos de voz e texto: mapa (zoom, região, destaque de contratos), navegação, status e relatórios em PDF.
O usuário enviou: "${trimmed}".
Contexto de tela atual: ${JSON.stringify(currentScreenContext || {})}
Contratos cadastrados no sistema: ${JSON.stringify(projects)}

Responda em JSON estrito com o formato:
{
  "reply": "Resposta detalhada, amigável, chamando o usuário pelo nome se houver e confirmando a ação operacional em português",
  "action": {
    "type": "navigate" | "map_focus" | "map_filter_state" | "map_highlight_contract" | "generate_report_pdf" | "ask_clarification" | "search" | "agenda" | "none",
    "targetUrl": "URL opcional (/dashboard, /kanban, /projects, /gantt, /calendar, /relatorios)",
    "region": "região ou estado se aplicável (ex: Goiás)",
    "contractName": "nome do contrato se aplicável",
    "period": "período se aplicável (ex: Agosto)",
    "reportType": "complete ou dashboard se aplicável",
    "clarificationPrompt": "pergunta de clarificação se necessário",
    "searchTerm": "termo de busca se aplicável"
  },
  "requiresClarification": boolean
}`;

  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "Você responde estritamente em JSON válido." },
        { role: "user", content: systemPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "operational_agent_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              reply: { type: "string" },
              action: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["navigate", "map_focus", "map_filter_state", "map_highlight_contract", "generate_report_pdf", "ask_clarification", "search", "agenda", "none"] },
                  targetUrl: { type: "string" },
                  region: { type: "string" },
                  contractName: { type: "string" },
                  period: { type: "string" },
                  reportType: { type: "string" },
                  clarificationPrompt: { type: "string" },
                  searchTerm: { type: "string" },
                },
                required: ["type", "targetUrl", "region", "contractName", "period", "reportType", "clarificationPrompt", "searchTerm"],
                additionalProperties: false,
              },
              requiresClarification: { type: "boolean" },
            },
            required: ["reply", "action", "requiresClarification"],
            additionalProperties: false,
          },
        },
      },
    });

    const choiceContent = res.choices[0]?.message?.content;
    const content = typeof choiceContent === "string" ? choiceContent : JSON.stringify(choiceContent);
    if (!content) throw new Error("Sem resposta do modelo.");
    return JSON.parse(content);
  } catch (err: any) {
    return {
      reply: `Compreendi seu pedido sobre "${trimmed}". Como posso ajudar na operação do mapa ou na geração de relatórios do Orbita?`,
      action: { type: "none", targetUrl: "", region: "", contractName: "", period: "", reportType: "", clarificationPrompt: "", searchTerm: "" },
      requiresClarification: false,
    };
  }
}
