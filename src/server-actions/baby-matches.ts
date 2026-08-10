"use server";

import { revalidatePath } from "next/cache";
import { requireBaby } from "@/lib/baby-auth";
import { confirmReportedMatch, disputeMatch, markMatchInProgress, reportMatchResult } from "@/lib/playtime-lifecycle";

export async function babyStartMatchAction(slug: string, matchId: string): Promise<void> {
  const baby = await requireBaby(slug);
  await markMatchInProgress(matchId, baby.id);
  revalidatePath(`/play/${slug}`);
}

export async function babyReportResultAction(slug: string, matchId: string, orderedBabyIds: string[]): Promise<void> {
  const baby = await requireBaby(slug);
  await reportMatchResult(matchId, orderedBabyIds, baby.id);
  revalidatePath(`/play/${slug}`);
}

export async function babyConfirmResultAction(slug: string, matchId: string): Promise<void> {
  const baby = await requireBaby(slug);
  await confirmReportedMatch(matchId, { type: "BABY", babyId: baby.id });
  revalidatePath(`/play/${slug}`);
}

export async function babyDisputeResultAction(slug: string, matchId: string): Promise<void> {
  const baby = await requireBaby(slug);
  await disputeMatch(matchId, baby.id);
  revalidatePath(`/play/${slug}`);
}
