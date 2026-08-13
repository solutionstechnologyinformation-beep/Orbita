import { describe, expect, it } from "vitest";
import { normalizeTaskAttachment, normalizeTaskAttachments } from "../shared/attachments";

describe("task attachment preview", () => {
  it("classifies PDF attachments using mime type or filename", () => {
    expect(normalizeTaskAttachment({ filename: "relatorio.pdf", fileUrl: "https://files.test/report", mimeType: "" })).toMatchObject({
      name: "relatorio.pdf",
      kind: "pdf",
    });
  });

  it("classifies image attachments and preserves the S3 URL", () => {
    expect(normalizeTaskAttachment({ filename: "foto.png", fileUrl: "https://files.test/foto.png", mimeType: "image/png" })).toMatchObject({
      name: "foto.png",
      url: "https://files.test/foto.png",
      kind: "image",
    });
  });

  it("uses download fallback for unsupported files and filters invalid records", () => {
    expect(normalizeTaskAttachment({ filename: "planilha.xlsx", fileUrl: "https://files.test/planilha.xlsx" })).toMatchObject({ kind: "download" });
    expect(normalizeTaskAttachments([{ filename: "sem-url" }, { filename: "ok.txt", fileUrl: "https://files.test/ok.txt" }])).toHaveLength(1);
  });
});
