/**
 * Fill {{placeholders}} in document/email templates.
 * Unknown placeholders are left untouched so missing data is visible
 * (rather than silently producing empty text).
 */
export type TemplateVars = Record<string, string | number | null | undefined>;

export function fillPlaceholders(text: string | null | undefined, vars: TemplateVars): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    const v = vars[key.toLowerCase()];
    return v === undefined || v === null || v === "" ? match : String(v);
  });
}

/** Placeholders still present after filling (shown as a warning before sending). */
export function unresolvedPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1]))];
}
