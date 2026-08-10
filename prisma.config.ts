// Prisma 7 config for the CLI (migrate/generate/studio). Not used at
// application runtime — the app's own PrismaClient is constructed in
// src/lib/prisma.ts with an explicit driver adapter (see that file for why).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
