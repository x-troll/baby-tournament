"use server";

import { revalidatePath } from "next/cache";
import { requireBaby } from "@/lib/baby-auth";
import { confirmMatchResult, markMatchInProgress } from "@/lib/playtime-lifecycle";

export async function babyStartMatchAction(slug: string, matchId: string): Promise<void> {
  const baby = await requireBaby(slug);
  await markMatchInProgress(matchId, baby.id);
  revalidatePath(`/play/${slug}`);
}

/**
 * Instant — a baby's own reported order finalizes the match right away
 * (same `confirmMatchResult` path the admin override uses, no separate
 * REPORTED-and-wait step). If a result turns out wrong, it's fixed
 * afterward via the admin panel's "Undo last result".
 */
export async function babyReportResultAction(slug: string, matchId: string, orderedBabyIds: string[]): Promise<void> {
  const baby = await requireBaby(slug);
  await confirmMatchResult({ matchId, orderedBabyIds, actor: { type: "BABY", babyId: baby.id } });
  revalidatePath(`/play/${slug}`);
}
