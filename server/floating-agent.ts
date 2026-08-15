import { getDb, getUserAiMemories, addUserAiMemory } from "./db";
import { summarizeProjectReportByName } from "./project-report-summary";
import { tasks, agendaEvents, crs } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

export async function processFloatingAgentCommand(userId: number, userMessage: string) {
  const db = await getDb();
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

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

  const [recentTasks, upcomingAgenda, projects, userMemories] = await Promise.all([
    db.select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
      crsId: tasks.crsId,
    }).from(tasks).orderBy(desc(tasks.createdAt)).limit(15),
    db.select({
      id: agendaEvents.id,
      title: agendaEvents.title,
      startDate: agendaEvents.startDate,
      type: agendaEvents.type,
    }).from(agendaEvents).orderBy(agendaEvents.startDate).limit(10),
    db.select({
      id: crs.id,
      name: crs.name,
      code: crs.code,
    }).from(crs).limit(10),
    getUserAiMemories(userId),
  ]);

  const contextPrompt = `Você é o Orbita AI Assistant, um assistente flutuante inteligente e altamente especializado da plataforma Orbita (LS Solutions).
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
