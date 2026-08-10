import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requires an explicit driver adapter rather than reading a
// datasource url embedded at generate time — see prisma.config.ts and
// PLAN.md for context. `connectionString` still comes from DATABASE_URL,
// which Next.js loads from .env locally and Heroku injects as a config var
// in production, so no other wiring is needed per environment.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse a single client across hot reloads in dev so we don't exhaust
// Postgres connections; a fresh client per Heroku dyno boot in production.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
