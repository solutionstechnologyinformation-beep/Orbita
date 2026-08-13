import { invokeLLM } from "./_core/llm";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function summarizePdfAttachment(fileUrl: string) {
  if (!fileUrl) {
    throw new Error("URL do arquivo PDF não informada.");
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Não foi possível baixar o PDF (${response.status} ${response.statusText}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let parsed: any;
  try {
    parsed = await pdfParse(buffer);
  } catch (error: any) {
    throw new Error(`Falha ao decodificar o PDF: ${error?.message ?? "arquivo inválido"}`);
  }

  const textContent = (parsed.text ?? "").trim();
  if (!textContent || textContent.length < 10) {
    return {
      summary: "O documento PDF não contém texto legível suficiente para gerar um resumo automático.",
      pageCount: parsed.numpages ?? 0,
      charCount: textContent.length,
    };
  }

  const truncatedText = textContent.slice(0, 15000);

  const prompt = `Analise o documento PDF anexado abaixo, extraia os pontos principais, o objetivo técnico/contratual e gere um resumo estruturado em português (com introdução, pontos chave e conclusões) para apoiar a gestão da tarefa no Orbita GIS & OS.\n\nConteúdo:\n${truncatedText}`;

  const llmResponse = await invokeLLM({
    messages: [
      { role: "system", content: "Você é um assistente sênior de engenharia civil e gestão de contratos em infraestrutura (Orbita / LS Solutions). Seja objetivo, preciso e profissional." },
      { role: "user", content: prompt },
    ],
  });

  const summary = llmResponse.choices[0]?.message?.content ?? "Não foi possível gerar o resumo.";

  return {
    summary,
    pageCount: parsed.numpages ?? 1,
    charCount: textContent.length,
  };
}
