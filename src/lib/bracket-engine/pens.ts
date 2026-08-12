import type { BabyId, PenAssignment, PenResolution, RoundPlan } from "./types";

/**
 * Solve 4a + 3b = n, maximizing the number of 4-pens (a). Returns null if
 * no exact decomposition exists — this only happens for n in {1, 2, 5}
 * (and anything below that), which is exactly why n=5 needs the special
 * bye-round rule at tournament start and why n=3/n=4 are handled as their
 * own RoundPlan variants rather than falling through to this solver.
 */
export function solveFourThreeSplit(n: number): { fourPens: number; threePens: number } | null {
  if (n < 0 || !Number.isInteger(n)) return null;
  let fourPens = Math.floor(n / 4);
  while (fourPens >= 0 && (n - 4 * fourPens) % 3 !== 0) {
    fourPens -= 1;
  }
  if (fourPens < 0) return null;
  const threePens = (n - 4 * fourPens) / 3;
  return { fourPens, threePens };
}

/**
 * Given how many babies are still alive entering a round, compute the
 * layout for that round. `isTournamentStart` gates the two decompositions
 * that only make sense as the very first round (N=3 and N=5) — see
 * PLAN.md "Gaps & gotchas" for why those can never occur mid-tournament
 * (every pen advances exactly 2, so the survivor count after any generic
 * round is always even).
 */
export function computeRoundLayout(aliveCount: number, isTournamentStart: boolean): RoundPlan {
  if (!Number.isInteger(aliveCount) || aliveCount < 3) {
    throw new Error(
      `computeRoundLayout: a playtime needs at least 3 babies to run, got ${aliveCount}`,
    );
  }

  if (aliveCount === 4) {
    return { kind: "FINAL_FOUR" };
  }

  if (aliveCount === 3) {
    if (!isTournamentStart) {
      throw new Error(
        "computeRoundLayout: N=3 mid-tournament violates the even-survivor invariant " +
          "(every pen advances exactly 2), this should only ever happen as a starting count",
      );
    }
    return { kind: "ROUND_ROBIN" };
  }

  if (aliveCount === 5) {
    if (!isTournamentStart) {
      throw new Error(
        "computeRoundLayout: N=5 mid-tournament violates the even-survivor invariant " +
          "(every pen advances exactly 2), this should only ever happen as a starting count",
      );
    }
    return { kind: "BYE_ROUND", penSize: 3, byeCount: 2 };
  }

  const split = solveFourThreeSplit(aliveCount);
  if (!split) {
    // Only reachable for aliveCount in {1, 2} once the special-cases above
    // are excluded, or a genuinely broken invariant upstream.
    throw new Error(
      `computeRoundLayout: no exact 4-pen/3-pen decomposition exists for N=${aliveCount}`,
    );
  }
  return { kind: "PENS", fourPens: split.fourPens, threePens: split.threePens };
}

/**
 * Distributes ranked babies (best first) across a set of pen slot sizes
 * using a snake/boustrophedon draw, so pen strength stays balanced even
 * when pen sizes are mixed (e.g. [4, 4, 3]). Not mandated by the spec —
 * a documented, reasonable default (see PLAN.md).
 */
export function assignBabiesToPens(rankedBabyIds: BabyId[], slotSizes: number[]): PenAssignment[] {
  const capacity = slotSizes.reduce((a, b) => a + b, 0);
  if (rankedBabyIds.length !== capacity) {
    throw new Error(
      `assignBabiesToPens: ${rankedBabyIds.length} babies does not match total pen capacity ${capacity}`,
    );
  }

  const visitOrder = snakeVisitOrder(slotSizes);
  const pens: BabyId[][] = slotSizes.map(() => []);
  rankedBabyIds.forEach((babyId, i) => {
    const penIndex = visitOrder[i]!;
    pens[penIndex]!.push(babyId);
  });
  return pens.map((babyIds, penIndex) => ({ penIndex, babyIds }));
}

function snakeVisitOrder(slotSizes: number[]): number[] {
  const filled = slotSizes.map(() => 0);
  const total = slotSizes.reduce((a, b) => a + b, 0);
  const visitOrder: number[] = [];
  let forward = true;

  while (visitOrder.length < total) {
    const indices = slotSizes.map((_, i) => i);
    if (!forward) indices.reverse();
    for (const penIndex of indices) {
      if (filled[penIndex]! < slotSizes[penIndex]!) {
        visitOrder.push(penIndex);
        filled[penIndex]! += 1;
      }
    }
    forward = !forward;
  }

  return visitOrder;
}

/**
 * N=5 at tournament start: the 3 lowest-seeded babies play one pen
 * (bottom naps), the other 2 get a direct bye. `rankedBabyIds` is best
 * first (rank 1 = best).
 */
export function computeByeRoundAssignment(rankedBabyIds: BabyId[]): {
  penBabyIds: [BabyId, BabyId, BabyId];
  byeBabyIds: [BabyId, BabyId];
} {
  if (rankedBabyIds.length !== 5) {
    throw new Error(`computeByeRoundAssignment: expected exactly 5 babies, got ${rankedBabyIds.length}`);
  }
  const [s1, s2, s3, s4, s5] = rankedBabyIds as [BabyId, BabyId, BabyId, BabyId, BabyId];
  return {
    byeBabyIds: [s1, s2],
    penBabyIds: [s3, s4, s5],
  };
}

/**
 * Resolves a pen after no-shows have shrunk its roster, independent of
 * the pen's original construction size. The spec only covers a 4-pen
 * shrinking to a 3-pen (still plays, top 2 advance); this fills the gap
 * for a 3-pen shrinking further — see PLAN.md "Gaps & gotchas #3". A pen
 * never *starts* with 1 or 2 (that's what the round-layout solver
 * guarantees); this only handles runtime shrinkage after assignment.
 */
export function resolvePenAfterNoShows(remainingBabyIds: BabyId[]): PenResolution {
  if (remainingBabyIds.length >= 3) {
    return { kind: "PLAYS", babyIds: remainingBabyIds };
  }
  if (remainingBabyIds.length === 2) {
    return { kind: "AUTO_ADVANCE", advancing: remainingBabyIds as [BabyId, BabyId] };
  }
  if (remainingBabyIds.length === 1) {
    return { kind: "BYE", advancing: remainingBabyIds as [BabyId] };
  }
  return { kind: "EMPTY" };
}
