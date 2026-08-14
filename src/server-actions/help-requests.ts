"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requireBaby } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminsHelpRequest } from "@/lib/telegram/notify";
import { acknowledgeHelpRequest, resolveHelpRequest } from "@/lib/help-requests";
import { HELP_REASON_KEYS, type HelpReasonKey } from "@/lib/terminology";

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
  reason: HelpReasonKey,
  note: string | null,
): Promise<{ error?: string }> {
  const baby = await requireBaby(slug);

  // Client-submitted data crossing the server boundary — same posture as
  // this app's other validated form fields (avatarId/selfRoleLabel in
  // baby-profile.ts). `reason` is a stable key (terminology.ts's
  // HelpReasonKey), not display text, so this stays correct regardless
  // of which skin/role variant actually produced the request.
  if (!HELP_REASON_KEYS.includes(reason)) {
    return { error: "Please pick one of the listed reasons." };
  }

  // Check-and-set in one conditional update, not read-then-write — two
  // rapid taps (a double-tap on the touchscreen this app is built for)
  // could otherwise both read the same stale lastHelpRequestAt and both
  // pass the cooldown gate before either write lands. Only the request
  // that actually flips lastHelpRequestAt forward gets to proceed; a
  // loser's `count` comes back 0.
  const cutoff = new Date(Date.now() - HELP_REQUEST_COOLDOWN_SECONDS * 1000);
  const { count } = await prisma.baby.updateMany({
    where: { id: baby.id, OR: [{ lastHelpRequestAt: null }, { lastHelpRequestAt: { lt: cutoff } }] },
    data: { lastHelpRequestAt: new Date() },
  });
  if (count === 0) {
    const elapsedMs = baby.lastHelpRequestAt ? Date.now() - baby.lastHelpRequestAt.getTime() : 0;
    const waitSeconds = Math.max(1, Math.ceil((HELP_REQUEST_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000));
    return { error: `Hang tight, you can ask again in ${waitSeconds}s.` };
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
    // Already have an open thread for this — don't flood the admin chat.
    // lastHelpRequestAt is already bumped above (still counts against the
    // cooldown so mashing the button doesn't bypass rate limiting).
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
