import { breakTies } from "./tiebreak";
import type { BabyId, PenResult, SeedEntry } from "./types";

/**
 * Score = the number of babies you finished ahead of, summed across every
 * pen you played. Self-normalising across pen sizes: 1st in a 4-pen = 3
 * pts, 2nd = 2; 1st in a 3-pen = 2 pts, 2nd = 1 — all just `size -
 * position`, no separate points table to invent or maintain.
 */
function scoreForPen(size: number, positionZeroIndexed: number): number {
  return size - (positionZeroIndexed + 1);
}

/**
 * Builds a net head-to-head function from raw pen results: for every pen
 * where both babies appear, whoever finished higher gets +1 in that
 * pairing. Babies who never shared a pen resolve to 0 (see tiebreak.ts —
 * that falls through to random, which is a deliberate, documented gap).
 */
export function buildHeadToHeadIndex(penResults: PenResult[]): (a: BabyId, b: BabyId) => number {
  const net = new Map<string, number>();
  const key = (a: BabyId, b: BabyId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (const pen of penResults) {
    for (let i = 0; i < pen.finishOrder.length; i++) {
      for (let j = i + 1; j < pen.finishOrder.length; j++) {
        const better = pen.finishOrder[i]!; // lower index = better finish
        const worse = pen.finishOrder[j]!;
        const k = key(better, worse);
        const sign = better < worse ? 1 : -1;
        net.set(k, (net.get(k) ?? 0) + sign);
      }
    }
  }

  return (a, b) => {
    if (a === b) return 0;
    const raw = net.get(key(a, b)) ?? 0;
    return a < b ? raw : -raw;
  };
}

/**
 * Computes seeding score + final rank/seed for the given babies from
 * their full pen history. Called once exactly 4 remain, over whichever
 * babies the caller passes (typically the 4 survivors) — `penResults`
 * can include pens involving babies no longer active, which is harmless
 * since only the requested `babyIds` are scored and ranked.
 */
export function computeSeedingScore(
  babyIds: BabyId[],
  penResults: PenResult[],
  rng: () => number = Math.random,
): SeedEntry[] {
  const scores = new Map<BabyId, number>(babyIds.map((id) => [id, 0]));

  for (const pen of penResults) {
    pen.finishOrder.forEach((babyId, i) => {
      if (scores.has(babyId)) {
        scores.set(babyId, scores.get(babyId)! + scoreForPen(pen.size, i));
      }
    });
  }

  const headToHead = buildHeadToHeadIndex(penResults);
  const ranked = breakTies(
    babyIds.map((babyId) => ({ babyId, score: scores.get(babyId)! })),
    { headToHead, rng },
  );

  return ranked.map((entry) => ({ babyId: entry.babyId, score: entry.score, seed: entry.rank }));
}
