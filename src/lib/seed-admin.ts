// Shared "create the first Daddy from env vars" logic — used by
// scripts/ensure-admin-seed.ts (idempotent, Heroku release-phase check)
// and NukeDatabaseButton's server action (which needs the exact same
// hashing/token logic to immediately re-seed after wiping everything).
// Deliberately no `import "server-only"` here — same reasoning as
// src/lib/auth.ts, this is also imported directly by the standalone
// script, which runs outside Next's build pipeline.
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { shortId } from "@/lib/short-id";
import type { Admin } from "@/generated/prisma/client";

/** Throws if ADMIN_USERNAME/ADMIN_PASSWORD aren't both set — callers decide whether that's fatal (the script) or just surfaces as an error (the nuke button, deliberately never leaving the deployment in a truly lockable state without those env vars). */
export async function seedFirstAdminFromEnv(): Promise<Admin> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("ADMIN_USERNAME/ADMIN_PASSWORD are not both set — cannot seed the first Daddy.");
  }

  const passwordHash = await hashPassword(password);
  return prisma.admin.create({
    data: { username, passwordHash, name: "Daddy", adminLinkToken: shortId() },
  });
}
