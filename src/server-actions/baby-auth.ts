"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { clearBabySession, createBabySession } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";

/**
 * Admin-only: creates a session for the given baby and redirects to
 * their screen — with `?playerPreview=true` so /playtimes/[slug] shows
 * the baby branch instead of bouncing this admin back to their own
 * admin branch (see that page's own doc comment).
 */
export async function previewAsBabyAction(babyId: string): Promise<void> {
  await requireAdmin();
  const baby = await prisma.baby.findUniqueOrThrow({ where: { id: babyId }, include: { playtime: true } });
  await createBabySession(baby.id);
  redirect(`/playtimes/${baby.playtime.slugNumber}?playerPreview=true`);
}

export async function babyLogoutAction(slug: string): Promise<void> {
  await clearBabySession();
  redirect(`/playtimes/${slug}/not-signed-in`);
}
