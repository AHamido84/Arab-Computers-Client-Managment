/** Shared (server + client) attachment DTO and mapper. */
export type AttachmentItem = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  label: string | null;
  createdAt: string;
  uploadedBy: string | null;
};

/** Server → client mapping helper. */
export function toAttachmentItems(
  rows: { id: string; filename: string; contentType: string; size: number; label: string | null; createdAt: Date; uploadedBy: { name: string } | null }[],
): AttachmentItem[] {
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), uploadedBy: r.uploadedBy?.name ?? null }));
}
