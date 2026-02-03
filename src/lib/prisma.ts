import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Add connection limit to prevent pool exhaustion with PgBouncer
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL || "";
  if (url && !url.includes("connection_limit")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}connection_limit=5`;
  }
  return url;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
