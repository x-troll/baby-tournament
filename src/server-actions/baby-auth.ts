"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { clearBabySession, createBabySession } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";

/** Admin-only: creates a session for the given baby and redirects to their screen — see PLAN.md Phase 5 note. */
export async function previewAsBabyAction(babyId: string): Promise<void> {
  await requireAdmin();
  const baby = await prisma.baby.findUniqueOrThrow({ where: { id: babyId }, include: { playtime: true } });
  await createBabySession(baby.id);
  redirect(`/play/${baby.playtime.slugNumber}`);
}

export async function babyLogoutAction(slug: string): Promise<void> {
  await clearBabySession();
  redirect(`/play/${slug}/not-signed-in`);
}
