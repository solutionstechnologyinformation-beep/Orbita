export type TaskAttachmentLike = {
  id?: number;
  filename?: string | null;
  name?: string | null;
  fileUrl?: string | null;
  url?: string | null;
  mimeType?: string | null;
  type?: string | null;
};

export type NormalizedTaskAttachment = {
  id?: number;
  name: string;
  url: string;
  type: string;
  kind: "pdf" | "image" | "download";
};

export function normalizeTaskAttachment(
  attachment: TaskAttachmentLike,
  index = 0,
): NormalizedTaskAttachment | null {
  const url = attachment.url ?? attachment.fileUrl;
  if (!url) return null;

  const name = attachment.name ?? attachment.filename ?? `Arquivo ${index + 1}`;
  const type = attachment.type ?? attachment.mimeType ?? "";
  const isPdf = type.toLowerCase() === "application/pdf" || /\.pdf(?:$|\?)/i.test(name) || /\.pdf(?:$|\?)/i.test(url);
  const isImage = type.toLowerCase().startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)(?:$|\?)/i.test(name) || /\.(png|jpe?g|gif|webp|svg)(?:$|\?)/i.test(url);

  return {
    id: attachment.id,
    name,
    url,
    type,
    kind: isPdf ? "pdf" : isImage ? "image" : "download",
  };
}

export function normalizeTaskAttachments(attachments: TaskAttachmentLike[] | null | undefined) {
  return (attachments ?? [])
    .map((attachment, index) => normalizeTaskAttachment(attachment, index))
    .filter((attachment): attachment is NormalizedTaskAttachment => attachment !== null);
}
