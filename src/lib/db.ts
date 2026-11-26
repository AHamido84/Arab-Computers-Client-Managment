import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton on a shared `pg` pool.
 *
 * Connection budget matters on serverless: every Vercel Function instance has
 * its own pool, and many instances can start at once. So we
 *  - prefer the provider's POOLED connection string at runtime
 *    (DATABASE_URL_POOLED, e.g. Prisma Postgres / Neon pooler); migrations keep
 *    using the direct URL (see prisma.config.ts),
 *  - cap the pool per instance (DB_POOL_MAX, default 5),
 *  - let Vercel close idle connections before an instance is suspended
 *    (attachDatabasePool — a no-op outside Vercel).
 */
function runtimeConnectionString() {
  const pooled = process.env.DATABASE_URL_POOLED;
  if (pooled && /^postgres(ql)?:\/\//.test(pooled)) return pooled;
  return process.env.DATABASE_URL!;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const pool = new Pool({
    connectionString: runtimeConnectionString(),
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const db = globalForPrisma.prisma ?? createClient();

// Reuse one client per process (dev hot-reload and Fluid Compute instance reuse).
globalForPrisma.prisma = db;
