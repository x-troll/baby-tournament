import { breakTies } from "./tiebreak";
import type { BabyId, Placement, RoundRobinResult } from "./types";

/** N=3 at tournament start: every pair plays exactly once. */
export function generateRoundRobinFixtures(babyIds: [BabyId, BabyId, BabyId]): [BabyId, BabyId][] {
  const [a, b, c] = babyIds;
  return [
    [a, b],
    [a, c],
    [b, c],
  ];
}

/**
 * "Skip brackets entirely, run a round-robin, most gold stars wins" —
 * this directly produces final placement (1st = Best Baby), there is no
 * Phase 2 for a 3-baby playtime. See PLAN.md "Gaps & gotchas #2" for why
 * that's the only coherent reading of "skip entirely."
 */
export function computeRoundRobinStandings(
  babyIds: [BabyId, BabyId, BabyId],
  results: RoundRobinResult[],
  rng: () => number = Math.random,
): Placement[] {
  const wins = new Map<BabyId, number>(babyIds.map((id) => [id, 0]));
  for (const result of results) {
    wins.set(result.winner, (wins.get(result.winner) ?? 0) + 1);
  }

  const key = (a: BabyId, b: BabyId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const net = new Map<string, number>();
  for (const result of results) {
    const sign = result.winner < result.loser ? 1 : -1;
    net.set(key(result.winner, result.loser), sign);
  }
  const headToHead = (a: BabyId, b: BabyId) => {
    if (a === b) return 0;
    const raw = net.get(key(a, b)) ?? 0;
    return a < b ? raw : -raw;
  };

  const ranked = breakTies(
    babyIds.map((babyId) => ({ babyId, score: wins.get(babyId)! })),
    { headToHead, rng },
  );

  return ranked.map((entry) => ({ babyId: entry.babyId, place: entry.rank }));
}
