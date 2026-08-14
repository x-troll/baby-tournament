"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmMatchResult, undoLastMatchResult } from "@/lib/playtime-lifecycle";

/** Shared by every server action that mutates a playtime's matches/roster — kept here rather than duplicated (playtimes.ts used to inline this same 5-line pattern). */
export async function revalidatePlaytimePage(playtimeId: string): Promise<void> {
  const playtime = await prisma.playtime.findUniqueOrThrow({
    where: { id: playtimeId },
    select: { slugNumber: true },
  });
  revalidatePath(`/playtimes/${playtime.slugNumber}`);
}

/**
 * Admin override result entry — the same `confirmMatchResult` code path
 * a baby's own self-report uses (see `babyReportResultAction`). Both go
 * straight to CONFIRMED, no separate waiting window (spec: "admin
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
  // Every position 1..N must be used exactly once — otherwise a tie (two
  // babies both set to "1") would silently resolve by DB iteration order
  // instead of the admin's actual intent, deciding who advances with no
  // indication a tie was ever entered.
  const positions = withPositions.map((p) => p.position).sort((a, b) => a - b);
  const isPermutation = positions.every((pos, i) => pos === i + 1);
  if (!isPermutation) {
    throw new Error("Each finisher needs a distinct position, 1 through the number of finishers — no ties or gaps.");
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
