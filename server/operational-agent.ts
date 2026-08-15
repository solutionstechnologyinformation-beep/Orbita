import { getDb } from "./db";
import { tasks, agendaEvents, crs } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

export type AgentOperationalAction = {
  type: "navigate" | "map_focus" | "map_filter_state" | "map_highlight_contract" | "generate_report_pdf" | "ask_clarification" | "search" | "agenda" | "none";
  targetUrl?: string;
  region?: string; // ex: "Goiás", "MG", "SP"
  contractName?: string;
  period?: string; // ex: "agosto", "2026", "julho"
  reportType?: string; // ex: "dashboard", "complete", "annual"
  clarificationPrompt?: string;
  searchTerm?: string;
};

export type AgentOperationalResponse = {
  reply: string;
  action: AgentOperationalAction;
  requiresClarification?: boolean;
};

export async function processOperationalAgentCommand(
  userId: number,
  companyId: number | null,
  userMessage: string,
  currentScreenContext?: { route?: string; activeState?: string; visibleContracts?: string[] }
): Promise<AgentOperationalResponse> {
  const db = await getDb();
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  // 1. Verificar comandos diretos de mapa (ex: "mostrar no mapa trechos de Goiás", "zoom em Goiás", "focar em MG")
  if (lower.includes("mapa") && (lower.includes("goiás") || lower.includes("goias") || lower.includes("mg") || lower.includes("são paulo") || lower.includes("sp") || lower.includes("ampliado"))) {
    const region = lower.includes("goiás") || lower.includes("goias") ? "Goiás" : lower.includes("mg") ? "Minas Gerais" : lower.includes("sp") || lower.includes("são paulo") ? "São Paulo" : "Goiás";
    
    // Buscar contratos visíveis nesta região no banco
    const allCrs = await db.select({ name: crs.name, state: crs.state }).from(crs);
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

  // 2. Verificar comandos diretos de PDF / relatório por período (ex: "gerar relatório em PDF de agosto", "relatório do mês de agosto")
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

  // 3. Verificar comandos de destaque de contrato (ex: "destacar o contrato X", "mostrar contrato BH Shopping")
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
    db.select({ id: tasks.id, title: tasks.title, priority: tasks.priority }).from(tasks).orderBy(desc(tasks.createdAt)).limit(10),
    db.select({ id: agendaEvents.id, title: agendaEvents.title, startDate: agendaEvents.startDate }).from(agendaEvents).orderBy(agendaEvents.startDate).limit(5),
    db.select({ id: crs.id, name: crs.name, state: crs.state }).from(crs).limit(15),
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
