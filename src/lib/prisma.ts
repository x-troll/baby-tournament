import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requires an explicit driver adapter rather than reading a
// datasource url embedded at generate time — see prisma.config.ts and
// PLAN.md for context. `connectionString` still comes from DATABASE_URL,
// which Next.js loads from .env locally and Heroku injects as a config var
// in production, so no other wiring is needed per environment.
//
// `ssl` matters: Heroku Postgres requires SSL, but the underlying `pg`
// driver this adapter wraps does NOT negotiate it automatically the way
// Prisma's own migrate engine does — `prisma migrate deploy` connecting
// fine while every query through this client got rejected as "access
// denied" (Heroku, prod, 2026-08-11) was this exact gap, not a real
// permissions issue. `rejectUnauthorized: false` matches Heroku's own
// documented pg/node-postgres setup (their cert chain isn't in the
// default trusted CA bundle). Local Postgres has no SSL at all, so this
// must stay off outside production.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse a single client across hot reloads in dev so we don't exhaust
// Postgres connections; a fresh client per Heroku dyno boot in production.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
