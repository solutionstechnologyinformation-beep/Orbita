import { getDb } from "./db";
import { crs, tasks, kanbanPhases } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

export async function summarizeProjectReportByName(projectNameQuery: string) {
  const db = await getDb();
  const projects = await db.select({
    id: crs.id,
    name: crs.name,
    code: crs.code,
    progress: crs.progress,
    state: crs.state,
    extensaoKm: crs.extensaoKm,
  }).from(crs).limit(50);

  const queryLower = projectNameQuery.toLowerCase().trim();
  const matched = projects.find((p: any) =>
    p.name.toLowerCase().includes(queryLower) ||
    (p.code && p.code.toLowerCase().includes(queryLower)) ||
    queryLower.includes(p.name.toLowerCase())
  ) || projects[0];

  if (!matched) {
    return "Não encontrei nenhum projeto ou contrato correspondente para gerar o relatório.";
  }

  const projectTasks = await db.select({
    id: tasks.id,
    title: tasks.title,
    priority: tasks.priority,
    status: tasks.blockReason,
  }).from(tasks).where(eq(tasks.crsId, matched.id)).orderBy(desc(tasks.createdAt)).limit(25);

  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((t: any) => t.status === "completed" || t.priority === "high").length;

  const summaryPrompt = `Você é o Orbita AI Assistant gerando um resumo executivo de relatório de projeto.
Projeto: ${matched.name} (Código: ${matched.code || "N/A"})
Estado: ${matched.state || "Não informado"}
Progresso registrado: ${matched.progress}%
Extensão: ${matched.extensaoKm ?? 0} km
Total de tarefas recentes analisadas: ${totalTasks}

Elabore um resumo executivo claro, objetivo e profissional em português para o gestor, destacando o progresso atual, pontos de atenção e status geral.`;

  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um analista de projetos executivo." },
        { role: "user", content: summaryPrompt },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return `📊 **Relatório Executivo — ${matched.name}**\n\n${content.trim()}`;
    }
  } catch {
    // fallback abaixo
  }

  return `📊 **Relatório — ${matched.name}**\n- Progresso: ${matched.progress}%\n- Estado: ${matched.state || "Geral"}\n- Extensão: ${matched.extensaoKm ?? 0} km\n- Tarefas recentes: ${totalTasks}`;
}
