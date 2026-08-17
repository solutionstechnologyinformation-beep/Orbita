import { getDb, getUserAiMemories, addUserAiMemory } from "./db";
import { summarizeProjectReportByName } from "./project-report-summary";
import { tasks, agendaEvents, crs, kanbanPhases } from "../drizzle/schema";
import { and, asc, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { processOperationalAgentCommand } from "./operational-agent";

export async function processFloatingAgentCommand(userId: number, companyId: number | null, userMessage: string, userRole: string = "user") {
  const db = await getDb();
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite)\b/.test(lower)) {
    const greeting = lower.includes("boa tarde") ? "Boa tarde" : lower.includes("boa noite") ? "Boa noite" : lower.includes("bom dia") ? "Bom dia" : "Olá";
    return {
      reply: `${greeting}! Que bom falar com você. Posso responder perguntas, abrir atividades, analisar demandas abertas ou ajudar a navegar pelo Orbita. Como posso ajudar?`,
      action: { type: "none", targetUrl: "", searchTerm: "" },
    };
  }

  // Se o usuário pedir para o assistente lembrar de algo ("lembre que...", "anote que...", "aprender que...")
  if (lower.startsWith("lembre que") || lower.startsWith("anote que") || lower.startsWith("aprenda que") || lower.startsWith("memorize que")) {
    const memoryContent = trimmed.replace(/^(lembre que|anote que|aprenda que|memorize que)\s*/i, "").trim();
    if (memoryContent.length >= 3) {
      await addUserAiMemory(userId, memoryContent, "preference");
      return {
        reply: `Entendido! Salvei esta informação na minha memória de longo prazo: "${memoryContent}". Posso consultá-la sempre que precisar.`,
        action: { type: "none", targetUrl: "", searchTerm: "" },
      };
    }
  }

  // Se o usuário perguntar o que o assistente sabe / memórias salvas
  if (lower.includes("o que você lembra") || lower.includes("minhas memórias") || lower.includes("o que você aprendeu") || lower.includes("sua memória")) {
    const mems = await getUserAiMemories(userId);
    if (mems.length === 0) {
      return {
        reply: "Ainda não tenho nenhuma preferência ou informação salva na minha memória. Você pode me ensinar dizendo 'Lembre que [sua preferência]'.",
        action: { type: "none", targetUrl: "", searchTerm: "" },
      };
    }
    const memList = mems.map((m: any, idx: number) => `${idx + 1}. ${m.content}`).join("\n");
    return {
      reply: `Aqui estão as informações e preferências que aprendi com você:\n\n${memList}\n\nVocê pode gerenciá-las ou apagá-las no painel do assistente.`,
      action: { type: "none", targetUrl: "", searchTerm: "" },
    };
  }

  // Se o usuário pedir para resumir relatório de projeto ("resumir relatório do projeto X", "relatório do projeto")
  if (lower.includes("resumir relatório") || lower.includes("relatório do projeto") || lower.includes("resumo do projeto")) {
    const query = trimmed.replace(/^(resumir relatório do projeto|relatório do projeto|resumo do projeto|resumir relatório)\s*/i, "").trim();
    const summary = await summarizeProjectReportByName(query);
    return {
      reply: summary,
      action: { type: "navigate", targetUrl: "/relatorios", searchTerm: "" },
    };
  }

  const taskMutation = await resolveTaskMutation(db, userId, companyId, userRole, trimmed);
  if (taskMutation) return taskMutation;

  const directNavigation = await resolveDirectNavigation(db, userId, companyId, trimmed);
  if (directNavigation) return directNavigation;

  // Executar agente operacional estendido (mapa, relatórios PDF, zoom, filtros)
  const operationalRes = await processOperationalAgentCommand(userId, companyId, trimmed);
  if (operationalRes && operationalRes.action.type !== "none") {
    return {
      reply: operationalRes.reply,
      action: {
        type: operationalRes.action.type === "map_focus" || operationalRes.action.type === "map_highlight_contract" || operationalRes.action.type === "generate_report_pdf" ? "navigate" : operationalRes.action.type as any,
        targetUrl: operationalRes.action.targetUrl || "/dashboard",
        searchTerm: operationalRes.action.searchTerm || operationalRes.action.contractName || operationalRes.action.region || "",
      },
    };
  }

  const [recentTasks, upcomingAgenda, projects, userMemories] = await Promise.all([
    db.select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
      crsId: tasks.crsId,
    }).from(tasks).innerJoin(crs, eq(tasks.crsId, crs.id)).where(companyId != null ? eq(crs.companyId, companyId) : eq(tasks.createdById, userId)).orderBy(desc(tasks.createdAt)).limit(15),
    db.select({
      id: agendaEvents.id,
      title: agendaEvents.title,
      startDate: agendaEvents.startDate,
      type: agendaEvents.type,
    }).from(agendaEvents).where(eq(agendaEvents.createdById, userId)).orderBy(agendaEvents.startDate).limit(10),
    db.select({
      id: crs.id,
      name: crs.name,
      code: crs.code,
    }).from(crs).where(companyId != null ? eq(crs.companyId, companyId) : eq(crs.createdById, userId)).limit(10),
    getUserAiMemories(userId),
  ]);

  const contextPrompt = `Você é o Orbita AI Assistant, um assistente conversacional e operacional da plataforma Orbita.
Você pode conversar naturalmente sobre assuntos gerais, responder saudações e dúvidas, além de navegar no sistema. Para análise de demandas, use somente os dados fornecidos e faça recomendações, sem inventar pessoas ou alterar tarefas.
O usuário enviou a mensagem: "${trimmed}".

Dados recentes do sistema:
- Tarefas recentes: ${JSON.stringify(recentTaskSummary(recentTasks))}
- Próximos compromissos na agenda: ${JSON.stringify(upcomingAgenda)}
- Projetos / Contratos (CRS): ${JSON.stringify(projects)}
- Memórias e preferências aprendidas do usuário: ${JSON.stringify(userMemories.map((m: any) => m.content))}

Analise a intenção e o contexto específico do usuário. Responda em JSON estrito com o seguinte formato:
{
  "reply": "Texto da resposta amigável, precisa e direta em português",
  "action": {
    "type": "navigate" | "search" | "agenda" | "none",
    "targetUrl": "URL opcional para navegação (ex: /tasks/12, /kanban, /calendar, /projects, /gantt, /sprints, /relatorios)",
    "searchTerm": "termo de busca opcional"
  }
}

Regras para action.type:
- Se o usuário pedir para ir a uma tarefa específica (ex: "ir para a tarefa 4", "abrir tarefa X"), defina type="navigate" e targetUrl="/tasks/{id}".
- Se o usuário pedir para ir a atividades, tarefas, demandas, Kanban ou quadro, defina type="navigate" e targetUrl="/kanban". Não use "/activities".
- Se o usuário pedir para ir ao Kanban, Agenda, Projetos, Gantt, Sprints ou Relatórios, defina type="navigate" e targetUrl correspondente (/kanban, /calendar, /projects, /gantt, /sprints, /relatorios).
- Se o usuário perguntar sobre compromissos ou agenda, defina type="agenda".
- Se o usuário pedir para pesquisar algo, defina type="search" com o searchTerm.
- Caso contrário, defina type="none".`;

  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "Você responde estritamente em JSON válido conforme solicitado." },
        { role: "user", content: contextPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "floating_agent_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              reply: { type: "string" },
              action: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["navigate", "search", "agenda", "none"] },
                  targetUrl: { type: "string" },
                  searchTerm: { type: "string" },
                },
                required: ["type", "targetUrl", "searchTerm"],
                additionalProperties: false,
              },
            },
            required: ["reply", "action"],
            additionalProperties: false,
          },
        },
      },
    });

    const choiceContent = res.choices[0]?.message?.content;
    const content = typeof choiceContent === "string" ? choiceContent : JSON.stringify(choiceContent);
    if (!content) {
      throw new Error("Sem resposta do modelo.");
    }

    const parsed = JSON.parse(content);
    return normalizeFloatingAgentResponse(parsed);
  } catch (err: any) {
    return fallbackFloatingAgentResponse(trimmed);
  }
}

async function resolveTaskMutation(db: any, userId: number, companyId: number | null, userRole: string, message: string) {
  const lower = normalizeAssistantText(message);
  const isAdmin = userRole === "admin" || userRole === "master_admin";
  const createIntent = /\b(crie|criar|adicionar|adicione)\b.*\b(tarefa|demanda|atividade)\b/.test(lower);
  const statusIntent = /\b(atualiz|alter|mude|mudar|marque|coloque|defina)\w*\b.*\b(tarefa|demanda|atividade)\b.*\b(status|como|para)\b/.test(lower)
    || /\b(tarefa|demanda|atividade)\b.*\b(conclu[ií]d[ao]s?|finalizad[ao]s?|bloquead[ao]s?|pendente|em andamento|arquivad[ao]s?)\b/.test(lower);
  if (!createIntent && !statusIntent) return null;
  if (!isAdmin) {
    return { reply: "Por segurança, somente administradores podem criar tarefas ou alterar status pelo Assistente Orbita. Posso abrir a tarefa para você revisar.", action: { type: "none", targetUrl: "", searchTerm: "" } };
  }

  const quoted = Array.from(message.matchAll(/["“”']([^"“”']+)["“”']/g)).map((match) => match[1].trim()).filter(Boolean);
  const contractMarker = message.match(/\b(?:no|do|da|para o|para a)\s+(?:contrato|crs|projeto)\s+(.+)$/i)?.[1]?.trim() ?? "";
  const cleanEntity = (value: string) => normalizeAssistantText(value).replace(/\b(?:como|para|status|conclu[ií]d[ao]s?|finalizad[ao]s?|bloquead[ao]s?|pendente|em andamento|arquivad[ao]s?)\b.*$/i, "").trim();

  if (createIntent) {
    const title = quoted[0] || message.replace(/^(?:por favor,?\s*)?(?:crie|criar|adicionar|adicione)\s+(?:uma\s+)?(?:nova\s+)?(?:tarefa|demanda|atividade)\s*/i, "").replace(/\s+(?:no|do|da|para o|para a)\s+(?:contrato|crs|projeto)\s+.+$/i, "").trim();
    const contractQuery = quoted[1] || contractMarker;
    if (title.length < 2) return { reply: "Informe o nome da nova tarefa. Exemplo: ‘crie a tarefa “Revisar projeto” no contrato “Trincheira W3”.’", action: { type: "none", targetUrl: "", searchTerm: "" } };
    const contractConditions = companyId != null ? eq(crs.companyId, companyId) : eq(crs.createdById, userId);
    const contracts = await db.select({ id: crs.id, name: crs.name, code: crs.code }).from(crs).where(contractConditions).limit(200);
    const normalizedContract = normalizeAssistantText(contractQuery);
    const contract = contracts.find((item: any) => !normalizedContract || normalizeAssistantText(item.name).includes(normalizedContract) || normalizeAssistantText(item.code ?? "").includes(normalizedContract));
    if (!contract) return { reply: contractQuery ? `Não encontrei o contrato ou projeto “${contractQuery}” no seu ambiente. Informe o nome exato para eu criar a tarefa no local correto.` : "Informe em qual contrato ou projeto devo criar a tarefa.", action: { type: "navigate", targetUrl: "/projects", searchTerm: contractQuery } };
    const [phase] = await db.select({ id: kanbanPhases.id, name: kanbanPhases.name }).from(kanbanPhases).where(eq(kanbanPhases.crsId, contract.id)).orderBy(asc(kanbanPhases.position)).limit(1);
    if (!phase) return { reply: "O contrato encontrado ainda não possui uma fase do Kanban para receber a nova tarefa.", action: { type: "navigate", targetUrl: `/kanban?crs=${contract.id}`, searchTerm: "" } };
    const now = new Date();
    const [result] = await db.insert(tasks).values({ crsId: contract.id, phaseId: phase.id, title: title.slice(0, 512), createdById: userId, position: Date.now() % 2000000000, createdAt: now, updatedAt: now, openedAt: now, statusChangedAt: now } as any);
    const id = Number((result as any).insertId);
    return { reply: `Criei a tarefa “${title}” no contrato “${contract.name}” e deixei na fase “${phase.name}”.`, action: { type: "navigate", targetUrl: `/tasks/${id}`, searchTerm: "" } };
  }

  const statusMatch = lower.match(/\b(conclu[ií]d[ao]s?|finalizad[ao]s?|bloquead[ao]s?|pendente|em andamento|arquivad[ao]s?|publicad[ao]s?|compartilhad[ao]s?)\b/);
  if (!statusMatch) return { reply: "Informe o status desejado: concluída, em andamento, bloqueada, pendente, compartilhada ou arquivada.", action: { type: "none", targetUrl: "", searchTerm: "" } };
  const statusText = normalizeAssistantText(statusMatch[1]);
  const nextStatus = statusText.startsWith("conclu") || statusText.startsWith("finaliz") ? "published" : statusText.startsWith("bloque") ? "blocked" : statusText.startsWith("pend") ? "pending" : statusText.startsWith("arquiv") ? "archived" : statusText.startsWith("public") ? "published" : statusText.startsWith("compart") ? "shared" : "in_progress";
  const quotedTask = quoted[0] || extractAssistantEntityQuery(message, ["tarefa", "tarefas", "demanda", "demandas", "atividade", "atividades"]);
  const taskQuery = cleanEntity(quotedTask).replace(/\b(?:status|como|para)\b.*$/i, "").trim();
  const taskConditions = companyId != null ? eq(crs.companyId, companyId) : eq(tasks.createdById, userId);
  const candidates = await db.select({ id: tasks.id, title: tasks.title, crsId: tasks.crsId, projectName: crs.name, phaseId: tasks.phaseId }).from(tasks).innerJoin(crs, eq(tasks.crsId, crs.id)).where(taskConditions).limit(300);
  const normalizedTask = normalizeAssistantText(taskQuery);
  const matches = candidates.filter((task: any) => !normalizedTask || normalizeAssistantText(task.title).includes(normalizedTask) || String(task.id) === taskQuery);
  if (matches.length !== 1) {
    if (matches.length > 1) return { reply: `Encontrei ${matches.length} tarefas compatíveis. Informe o nome completo ou o número da tarefa para eu alterar o status correto.`, action: { type: "navigate", targetUrl: "/kanban", searchTerm: taskQuery } };
    return { reply: `Não encontrei uma tarefa correspondente a “${taskQuery || "esse comando"}” no seu ambiente.`, action: { type: "navigate", targetUrl: "/kanban", searchTerm: taskQuery } };
  }
  const target = matches[0];
  const now = new Date();
  const phaseUpdate = nextStatus === "published" ? await db.select({ id: kanbanPhases.id }).from(kanbanPhases).where(and(eq(kanbanPhases.crsId, target.crsId), eq(kanbanPhases.isTerminal, true))).orderBy(asc(kanbanPhases.position)).limit(1) : nextStatus === "in_progress" ? await db.select({ id: kanbanPhases.id }).from(kanbanPhases).where(and(eq(kanbanPhases.crsId, target.crsId), eq(kanbanPhases.isTerminal, false))).orderBy(asc(kanbanPhases.position)).limit(1) : [];
  await db.update(tasks).set({ status: nextStatus as any, ...(phaseUpdate[0] ? { phaseId: phaseUpdate[0].id } : {}), statusChangedAt: now, completedAt: nextStatus === "published" ? now : null, updatedAt: now } as any).where(eq(tasks.id, target.id));
  return { reply: `Atualizei o status da tarefa “${target.title}” para “${statusText}”.`, action: { type: "navigate", targetUrl: `/tasks/${target.id}`, searchTerm: "" } };
}

async function resolveDirectNavigation(db: any, userId: number, companyId: number | null, message: string) {
  const lower = normalizeAssistantText(message);
  const asksTask = /\b(tarefa|tarefas|demanda|demandas|atividade|atividades)\b/.test(lower);
  const asksContract = /\b(contrato|contratos|crs|projeto|projetos)\b/.test(lower);
  const asksNavigation = /\b(abrir|abra|ir para|me leve|direcion|mostrar|mostre|acessar|acesso|ver)\b/.test(lower);
  const asksOverdue = /\b(atrasad[ao]s?|vencid[ao]s?|fora do prazo|em atraso)\b/.test(lower);
  if ((!asksTask && !asksContract) || (!asksNavigation && !asksOverdue)) return null;

  const scope = companyId != null ? eq(crs.companyId, companyId) : eq(tasks.createdById, userId);
  const quotedQuery = message.match(/["“”']([^"“”']+)["“”']/)?.[1] ?? "";
  const taskQuery = quotedQuery || extractAssistantEntityQuery(message, ["tarefa", "tarefas", "demanda", "demandas", "atividade", "atividades"]);
  const contractQuery = quotedQuery || extractAssistantEntityQuery(message, ["contrato", "contratos", "crs", "projeto", "projetos"]);
  const genericWords = new Set(["a", "o", "as", "os", "uma", "um", "mais", "urgente", "atrasada", "atrasado", "atrasadas", "atrasados", "vencida", "vencido", "vencidas", "vencidos", "em", "do", "da", "de", "para", "me", "por", "favor", "que", "está", "esta", "estao", "estão", "abrir", "abra", "mostrar", "mostre", "ver", "ir", "leve", "direcionar"]);
  const matchesQuery = (value: string | null | undefined, query: string) => {
    const normalizedValue = normalizeAssistantText(value ?? "");
    const terms = normalizeAssistantText(query).split(/\s+/).filter((term) => term.length > 2 && !genericWords.has(term));
    return terms.length > 0 && terms.every((term) => normalizedValue.includes(term));
  };

  if (asksTask) {
    const overdueCondition = asksOverdue
      ? and(isNotNull(tasks.dueDate), lt(tasks.dueDate, new Date()))
      : undefined;
    const conditions = overdueCondition ? and(scope, overdueCondition) : scope;
    const candidates = await db.select({
      id: tasks.id,
      title: tasks.title,
      crsId: tasks.crsId,
      crsName: crs.name,
      dueDate: tasks.dueDate,
    }).from(tasks).innerJoin(crs, eq(tasks.crsId, crs.id)).where(conditions).orderBy(tasks.dueDate, desc(tasks.priority)).limit(100);
    const matching = taskQuery ? candidates.filter((task: any) => matchesQuery(task.title, taskQuery) || matchesQuery(task.crsName, taskQuery)) : candidates;
    const target = matching[0];
    if (target) {
      const prefix = asksOverdue ? "Encontrei a tarefa em atraso" : "Encontrei a tarefa";
      return {
        reply: `${prefix} “${target.title}”${target.crsName ? ` no contrato “${target.crsName}”` : ""}. Estou abrindo o detalhe agora.`,
        action: { type: "navigate", targetUrl: `/tasks/${target.id}`, searchTerm: "" },
      };
    }
    if (asksOverdue) {
      return { reply: "Não encontrei tarefas em atraso no seu ambiente atual. Vou abrir o Kanban para você revisar os prazos.", action: { type: "navigate", targetUrl: "/kanban", searchTerm: "" } };
    }
  }

  if (asksContract) {
    const contracts = await db.select({ id: crs.id, name: crs.name, code: crs.code }).from(crs).where(companyId != null ? eq(crs.companyId, companyId) : eq(crs.createdById, userId)).limit(100);
    const target = contracts.find((contract: any) => matchesQuery(contract.name, contractQuery) || matchesQuery(contract.code, contractQuery))
      ?? (contracts.length === 1 && asksNavigation ? contracts[0] : null);
    if (target) {
      return {
        reply: `Encontrei o contrato “${target.name}”. Estou abrindo o Kanban desse contrato para você.`,
        action: { type: "navigate", targetUrl: `/kanban?crs=${target.id}`, searchTerm: "" },
      };
    }
    if (asksNavigation) return { reply: "Vou abrir a lista de projetos e contratos para você escolher o registro correto.", action: { type: "navigate", targetUrl: "/projects", searchTerm: "" } };
  }

  return null;
}

function normalizeAssistantText(value: string) {
  return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
}

function extractAssistantEntityQuery(message: string, entityWords: string[]) {
  const escaped = entityWords.join("|");
  const match = message.match(new RegExp(`(?:${escaped})\\s+(.+)$`, "i"));
  return (match?.[1] ?? "").replace(/\\b(atrasad[ao]s?|vencid[ao]s?|em atraso|fora do prazo)\\b/gi, " ").trim();
}

export function normalizeFloatingAgentResponse(value: any) {
  const reply = typeof value?.reply === "string" ? value.reply.slice(0, 2000) : "Não consegui interpretar esse comando.";
  const rawAction = value?.action ?? {};
  const type = ["navigate", "search", "agenda", "none"].includes(rawAction.type) ? rawAction.type : "none";
  const targetUrl = typeof rawAction.targetUrl === "string" ? rawAction.targetUrl : "";
  const searchTerm = typeof rawAction.searchTerm === "string" ? rawAction.searchTerm.slice(0, 200) : "";
  const allowedRoute = /^\/(dashboard|kanban|calendar|projects|gantt|sprints|relatorios|tasks\/\d+)(\?[a-zA-Z0-9_=&%+.-]+)?$/;
  const safeTargetUrl = allowedRoute.test(targetUrl) ? targetUrl : "";

  if (type === "navigate" && !safeTargetUrl) return { reply, action: { type: "none", targetUrl: "", searchTerm: "" } };
  if (type === "agenda") return { reply, action: { type: "agenda", targetUrl: "/calendar", searchTerm: "" } };
  if (type === "search" && searchTerm) return { reply, action: { type: "search", targetUrl: "/kanban", searchTerm } };
  if (type === "navigate") return { reply, action: { type: "navigate", targetUrl: safeTargetUrl, searchTerm: "" } };
  return { reply, action: { type: "none", targetUrl: "", searchTerm: "" } };
}

export function fallbackFloatingAgentResponse(userMessage: string) {
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  if ((lower.includes("atividade") || lower.includes("atividades") || lower.includes("demanda") || lower.includes("demandas") || lower.includes("tarefa") || lower.includes("tarefas")) && !(/\btarefas?\b.*\d+/.test(lower))) {
    return {
      reply: "Abrindo as atividades no Kanban para você revisar as demandas.",
      action: { type: "navigate", targetUrl: "/kanban", searchTerm: "" },
    };
  }
  if (lower.includes("kanban") || lower.includes("quadro")) {
    return {
      reply: "Abrindo o Kanban para você gerenciar suas tarefas.",
      action: { type: "navigate", targetUrl: "/kanban", searchTerm: "" },
    };
  }
  if (lower.includes("agenda") || lower.includes("calendario") || lower.includes("reuniao")) {
    return {
      reply: "Aqui estão os compromissos agendados na sua agenda.",
      action: { type: "agenda", targetUrl: "/calendar", searchTerm: "" },
    };
  }
  if (lower.includes("projeto") || lower.includes("crs")) {
    return {
      reply: "Redirecionando para a lista de projetos e contratos.",
      action: { type: "navigate", targetUrl: "/projects", searchTerm: "" },
    };
  }
  if (lower.includes("gantt")) {
    return {
      reply: "Abrindo o cronograma Gantt.",
      action: { type: "navigate", targetUrl: "/gantt", searchTerm: "" },
    };
  }
  if (lower.includes("sprint")) {
    return {
      reply: "Abrindo as Sprints ativas.",
      action: { type: "navigate", targetUrl: "/sprints", searchTerm: "" },
    };
  }
  if (lower.includes("relatorio")) {
    return {
      reply: "Abrindo a central de relatórios.",
      action: { type: "navigate", targetUrl: "/relatorios", searchTerm: "" },
    };
  }
  if (lower.includes("tarefa") || lower.includes("task")) {
    const match = trimmed.match(/\d+/);
    if (match) {
      const taskId = match[0];
      return {
        reply: `Abrindo a tarefa #${taskId}.`,
        action: { type: "navigate", targetUrl: `/tasks/${taskId}`, searchTerm: "" },
      };
    }
  }

  return {
    reply: "Olá! Sou o assistente inteligente do Orbita. Posso te ajudar com comandos específicos, navegar pelo sistema, consultar agenda ou aprender suas preferências (diga 'Lembre que...'). Como posso ajudar?",
    action: { type: "none", targetUrl: "", searchTerm: "" },
  };
}

function recentTaskSummary(tasks: any[]) {
  return tasks.map(t => `#${t.id}: ${t.title} (prioridade ${t.priority})`);
}
