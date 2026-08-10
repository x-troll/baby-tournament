import type { BabyId } from "./types";

export interface EliminatedRoundEntry {
  babyId: BabyId;
  /** Size of the pen they were eliminated from this round. */
  penSize: number;
  /** Their finishing position within that pen (1-indexed, 1 = best). */
  penPosition: number;
  /** Stable, deterministic tiebreaker when pen performance is equal (e.g. registration order — lower is better). */
  tiebreakOrder: number;
}

/**
 * Assigns exact final placements to a cohort of babies eliminated in the
 * same playpen round. Every pen in a round advances exactly 2, so
 * everyone eliminated that round is tied for the same *range* of places
 * (e.g. a round that shrinks the field from 12 to 8 eliminates 4 babies
 * who collectively occupy places 9-12) — the spec doesn't say how to
 * turn that into exact numbers, so this does it deterministically:
 * better pen performance this round (`size - position`, the same formula
 * seeding.ts uses for the beaten-count score) ranks first, then the
 * supplied `tiebreakOrder`. Deliberately never random — a cosmetic
 * placement number isn't the kind of competitive stakes the spec's "then
 * random" tiebreak is about; that's reserved for seeding.ts.
 */
export function assignEliminatedPlacements(
  eliminated: EliminatedRoundEntry[],
  aliveCountBeforeRound: number,
): Map<BabyId, number> {
  if (eliminated.length === 0) return new Map();
  if (eliminated.length > aliveCountBeforeRound) {
    throw new Error(
      `assignEliminatedPlacements: ${eliminated.length} eliminated exceeds ${aliveCountBeforeRound} alive before the round`,
    );
  }

  const sorted = [...eliminated].sort((a, b) => {
    const scoreA = a.penSize - a.penPosition;
    const scoreB = b.penSize - b.penPosition;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.tiebreakOrder - b.tiebreakOrder;
  });

  const bestPlace = aliveCountBeforeRound - eliminated.length + 1;
  const placements = new Map<BabyId, number>();
  sorted.forEach((entry, index) => {
    placements.set(entry.babyId, bestPlace + index);
  });
  return placements;
}
