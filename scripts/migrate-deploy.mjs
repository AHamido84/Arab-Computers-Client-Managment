/**
 * Build step: `prisma migrate deploy` with retries.
 *
 * On serverless databases the connection limit can be briefly exhausted by
 * the previous deployment's instances while a new build runs, which makes the
 * migration fail with "too many connections". Retry with backoff instead of
 * failing the whole deploy on a transient refusal.
 */
import { spawnSync } from "node:child_process";

const attempts = Number(process.env.MIGRATE_ATTEMPTS ?? 6);
for (let i = 1; i <= attempts; i++) {
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { encoding: "utf8", env: process.env });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status === 0) process.exit(0);
  const out = `${r.stdout}\n${r.stderr}`;
  const transient = /too many connections|P1001|P1002|Can't reach database|timed out|ECONNRESET/i.test(out);
  if (!transient || i === attempts) process.exit(r.status ?? 1);
  const wait = Math.min(60, 5 * 2 ** (i - 1));
  console.log(`[migrate] transient database error — retrying in ${wait}s (attempt ${i + 1}/${attempts})`);
  await new Promise((res) => setTimeout(res, wait * 1000));
}
