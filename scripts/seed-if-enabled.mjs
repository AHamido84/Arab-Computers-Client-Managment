/**
 * Build step: seed the database only when SEED_ON_BUILD=1.
 *
 * Use it for the first deploy (or to recreate base data) when you can't run
 * `npm run db:seed` locally — e.g. the database URL is a Sensitive variable that
 * `vercel env pull` won't download. Set SEED_ON_BUILD=1, redeploy, then REMOVE
 * the variable so deleted demo users aren't recreated on later builds.
 * The seed itself is idempotent (never overwrites existing settings/users and
 * only creates demo business data on an empty database).
 */
import { spawnSync } from "node:child_process";

if (process.env.SEED_ON_BUILD !== "1") {
  console.log("[seed] SEED_ON_BUILD is not set — skipping seed.");
  process.exit(0);
}
console.log("[seed] SEED_ON_BUILD=1 — running prisma db seed…");
const r = spawnSync("npx", ["prisma", "db", "seed"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
