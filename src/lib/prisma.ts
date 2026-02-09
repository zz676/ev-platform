import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

// Optimize connection string for Supabase PgBouncer (session mode)
// - connection_limit=1: Minimal connections per serverless instance
// - pgbouncer=true: Enable PgBouncer compatibility mode
// - pool_timeout=10: Fail fast if pool is exhausted
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL || "";
  if (!url) return url;

  const urlObj = new URL(url);

  // Set optimal parameters for serverless + PgBouncer
  if (!urlObj.searchParams.has("connection_limit")) {
    urlObj.searchParams.set("connection_limit", "1");
  }
  if (!urlObj.searchParams.has("pgbouncer")) {
    urlObj.searchParams.set("pgbouncer", "true");
  }
  if (!urlObj.searchParams.has("pool_timeout")) {
    urlObj.searchParams.set("pool_timeout", "10");
  }

  return urlObj.toString();
};

const getPgPool = () => {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  globalForPrisma.pgPool = pool;
  return pool;
};

const createPrismaClient = () => {
  const adapter = new PrismaPg(getPgPool(), { disposeExternalPool: false });
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    adapter,
  });
};

// IMPORTANT: Always use singleton pattern in ALL environments
// This prevents connection pool exhaustion in serverless (Vercel)
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache the client globally - critical for both dev AND production
globalForPrisma.prisma = prisma;

export default prisma;
