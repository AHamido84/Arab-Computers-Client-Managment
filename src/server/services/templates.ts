import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_DOCUMENT_TEMPLATES } from "@/lib/templates/defaults";
import type { DocumentKind } from "@/generated/prisma/enums";

/** Document template body per language, falling back to the built-in default. */
export async function getDocumentTemplates(kind: DocumentKind) {
  const rows = await db.documentTemplate.findMany({ where: { kind } });
  const pick = (lang: "ar" | "en") => rows.find((r) => r.lang === lang) ?? DEFAULT_DOCUMENT_TEMPLATES[kind][lang];
  return { ar: pick("ar"), en: pick("en") };
}
