/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * CRON_SECRET env var is set on the project. Reject everything else.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
