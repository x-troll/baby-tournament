"use server";

import { redirect } from "next/navigation";
import { requireAdmin, clearAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedFirstAdminFromEnv } from "@/lib/seed-admin";

/**
 * Wipes every playtime (cascades to babies/matches/help requests, per
 * schema.prisma's onDelete: Cascade) and every admin, then immediately
 * re-seeds exactly one fresh admin from ADMIN_USERNAME/ADMIN_PASSWORD —
 * same logic scripts/ensure-admin-seed.ts uses, so this never leaves the
 * deployment genuinely locked out. The caller's own session is invalid
 * the moment their Admin row is gone, so this always signs out and sends
 * them back to the login screen rather than back to a settings page they
 * no longer have a session for.
 */
export async function nukeDatabaseAction(): Promise<void> {
  await requireAdmin();

  await prisma.playtime.deleteMany({});
  await prisma.admin.deleteMany({});
  await seedFirstAdminFromEnv();

  await clearAdminSession();
  redirect("/login");
}
