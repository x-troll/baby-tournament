"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requireBaby } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminsHelpRequest } from "@/lib/telegram/notify";
import { acknowledgeHelpRequest, resolveHelpRequest } from "@/lib/help-requests";

const HELP_REQUEST_COOLDOWN_SECONDS = 60;

/**
 * "Request help from Daddy" — 60s cooldown per baby, and repeat requests
 * for the same match collapse into one thread rather than flooding the
 * admin chat (spec). A baby's most recent unresolved match, if any,
 * scopes the thread key; babies with no active match (e.g. between
 * rounds) get a per-playtime general thread instead.
 */
export async function createHelpRequestAction(
  slug: string,
  reason: string,
  note: string | null,
): Promise<{ error?: string }> {
  const baby = await requireBaby(slug);

  if (baby.lastHelpRequestAt) {
    const elapsedMs = Date.now() - baby.lastHelpRequestAt.getTime();
    if (elapsedMs < HELP_REQUEST_COOLDOWN_SECONDS * 1000) {
      const waitSeconds = Math.ceil((HELP_REQUEST_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
      return { error: `Hang tight, you can ask again in ${waitSeconds}s.` };
    }
  }

  const activeParticipation = await prisma.matchParticipant.findFirst({
    where: { babyId: baby.id, match: { status: { not: "CONFIRMED" } } },
    orderBy: { match: { createdAt: "desc" } },
  });
  const threadKey = activeParticipation
    ? `help-${baby.id}-${activeParticipation.matchId}`
    : `help-${baby.id}-general`;

  const existingOpenThread = await prisma.helpRequest.findFirst({
    where: { threadKey, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });
  if (existingOpenThread) {
    // Already have an open thread for this — don't flood the admin chat,
    // but still count it against the cooldown so mashing the button
    // doesn't bypass rate limiting.
    await prisma.baby.update({ where: { id: baby.id }, data: { lastHelpRequestAt: new Date() } });
    revalidatePath("/admin/help-requests");
    return {};
  }

  const created = await prisma.helpRequest.create({
    data: {
      playtimeId: baby.playtimeId,
      babyId: baby.id,
      matchId: activeParticipation?.matchId ?? null,
      reason,
      note,
      threadKey,
    },
  });
  await prisma.baby.update({ where: { id: baby.id }, data: { lastHelpRequestAt: new Date() } });
  revalidatePath("/admin/help-requests");
  await notifyAdminsHelpRequest(created.id);
  return {};
}

/** "On my way" — thin wrapper around the shared core (src/lib/help-requests.ts), same as the Telegram-button path. */
export async function acknowledgeHelpRequestAction(id: string): Promise<void> {
  await requireAdmin();
  await acknowledgeHelpRequest(id);
  revalidatePath("/admin/help-requests");
}

export async function resolveHelpRequestAction(id: string): Promise<void> {
  const admin = await requireAdmin();
  await resolveHelpRequest(id, admin.id);
  revalidatePath("/admin/help-requests");
}
