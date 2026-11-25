/**
 * Document number formatting.
 * Tokens: {YYYY} {YY} {MM} and a zero-padded counter {0000} (width = number of zeros).
 * Counter scope resets yearly when the format contains a year token.
 */
export function formatDocNumber(format: string, counter: number, date = new Date()): string {
  const yyyy = String(date.getUTCFullYear());
  return format
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(2))
    .replace(/\{MM\}/g, String(date.getUTCMonth() + 1).padStart(2, "0"))
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(counter).padStart(zeros.length, "0"));
}

export function counterScope(kind: string, format: string, date = new Date()): string {
  return /\{YY(YY)?\}/.test(format) ? `${kind}:${date.getUTCFullYear()}` : kind;
}
