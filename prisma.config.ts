import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

const envFiles = [".env.local", ".env"];
for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
  }
}

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DIRECT_URL or DATABASE_URL for Prisma config.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
