"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmMatchResult, undoLastMatchResult } from "@/lib/playtime-lifecycle";

async function revalidatePlaytimePage(playtimeId: string): Promise<void> {
  const playtime = await prisma.playtime.findUniqueOrThrow({
    where: { id: playtimeId },
    select: { slugNumber: true },
  });
  revalidatePath(`/playtimes/${playtime.slugNumber}`);
}

/**
 * Admin override result entry — the same `confirmMatchResult` code path
 * Phase 5 will wire baby self-report + the 60s auto-confirm timer to.
 * Admin's version always goes straight to CONFIRMED (spec: "admin
 * override always available. One code path for both cases.").
 */
export async function adminReportMatchResultAction(
  playtimeId: string,
  matchId: string,
  orderedBabyIds: string[],
): Promise<void> {
  const admin = await requireAdmin();
  await confirmMatchResult({
    matchId,
    orderedBabyIds,
    actor: { type: "ADMIN", adminId: admin.id },
  });
  await revalidatePlaytimePage(playtimeId);
}

/**
 * Plain-HTML-form-friendly wrapper: reads `position-<babyId>` fields
 * (1..N) from the submitted form and turns them into the ordered array
 * `confirmMatchResult` expects. No client JS required for the Phase 4
 * admin override UI — Phase 5's baby-facing drag-to-reorder calls
 * `confirmMatchResult` directly instead, since it already has the order.
 */
export async function reportMatchResultFormAction(
  playtimeId: string,
  matchId: string,
  participantBabyIds: string[],
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const withPositions = participantBabyIds.map((babyId) => ({
    babyId,
    position: Number(formData.get(`position-${babyId}`)),
  }));
  if (withPositions.some((p) => !Number.isInteger(p.position) || p.position < 1)) {
    throw new Error("Every finisher needs a valid position.");
  }
  const orderedBabyIds = withPositions.sort((a, b) => a.position - b.position).map((p) => p.babyId);

  await confirmMatchResult({
    matchId,
    orderedBabyIds,
    actor: { type: "ADMIN", adminId: admin.id },
  });
  await revalidatePlaytimePage(playtimeId);
}

export async function undoMatchResultAction(playtimeId: string, matchId: string): Promise<void> {
  const admin = await requireAdmin();
  await undoLastMatchResult(matchId, admin.id);
  await revalidatePlaytimePage(playtimeId);
}

export async function getMatchEventLog(matchId: string) {
  await requireAdmin();
  return prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: { id: "asc" },
    include: { actorAdmin: true, actorBaby: true },
  });
}
