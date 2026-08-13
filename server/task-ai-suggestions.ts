import { invokeLLM } from "./_core/llm";
import { getTaskById } from "./db";

export function buildTaskSuggestionFallback(task: { title: string; priority: string }) {
  return [
    `Progresso atualizado para a tarefa "${task.title}". Trecho verificado em campo conforme diretrizes contratuais.`,
    `Documentação e evidências anexadas para revisão da equipe técnica. Prioridade mantida como ${task.priority}.`,
    "Atividade em andamento sem pendências impeditivas. Próxima etapa agendada para o cronograma vigente.",
  ];
}

export async function generateTaskContextSuggestions(taskId: number) {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }

  const prompt = `Você é o assistente inteligente do Orbita GIS & OS (LS Solutions).
Analise a seguinte tarefa e gere 3 sugestões de comentários profissionais e contextuais que um engenheiro ou gestor de contratos pode adicionar como progresso ou atualização:
- Título: ${task.title}
- Descrição: ${task.description || "N/A"}
- Prioridade: ${task.priority}
- Status: ${task.status}
- Setor: ${task.setor || "N/A"}

Responda em JSON estrito com o seguinte formato:
{
  "suggestions": [
    "Primeiro comentário sugerido em português",
    "Segundo comentário sugerido em português",
    "Terceiro comentário sugerido em português"
  ]
}`;

  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "Você responde estritamente em JSON válido conforme solicitado." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_suggestions_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ["suggestions"],
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
    return parsed.suggestions as string[];
  } catch (err: any) {
    // Fallback inteligente caso a IA falhe
    return buildTaskSuggestionFallback(task);
  }
}
