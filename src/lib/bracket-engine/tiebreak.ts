import type { BabyId } from "./types";

export interface TiebreakContext {
  /**
   * Net head-to-head result between two babies: positive means `a` beat
   * `b` more often (across whatever shared history the caller indexed),
   * negative means the reverse, zero means even or they never played.
   */
  headToHead: (a: BabyId, b: BabyId) => number;
  /** Injectable RNG in [0, 1) — deterministic in tests, Math.random in prod. */
  rng: () => number;
}

/**
 * Ranks entries by score (descending), then head-to-head, then random —
 * the spec's tiebreak chain. Used for both final-four seeding and the
 * N=3 round-robin standings.
 *
 * Head-to-head is well-defined for a 2-way tie. For 3+ babies tied on
 * score, there's no single spec-given resolution (see PLAN.md "Gaps &
 * gotchas #4") — this resolves it by tallying, per baby, how many other
 * members of the tied group they have a positive head-to-head record
 * against, and sorting by that tally. Anything still tied after that
 * (including "never played" pairs, which have headToHead = 0) is
 * shuffled randomly via `ctx.rng`.
 */
export function breakTies<T extends { babyId: BabyId; score: number }>(
  entries: T[],
  ctx: TiebreakContext,
): (T & { rank: number })[] {
  const byScoreDesc = [...entries].sort((a, b) => b.score - a.score);

  const ranked: (T & { rank: number })[] = [];
  let i = 0;
  while (i < byScoreDesc.length) {
    let j = i + 1;
    while (j < byScoreDesc.length && byScoreDesc[j]!.score === byScoreDesc[i]!.score) {
      j += 1;
    }
    const group = byScoreDesc.slice(i, j);
    const ordered = orderTiedGroup(group, ctx);
    for (const entry of ordered) {
      ranked.push({ ...entry, rank: ranked.length + 1 });
    }
    i = j;
  }
  return ranked;
}

function orderTiedGroup<T extends { babyId: BabyId; score: number }>(
  group: T[],
  ctx: TiebreakContext,
): T[] {
  if (group.length <= 1) return group;

  if (group.length === 2) {
    const [a, b] = group as [T, T];
    const h2h = ctx.headToHead(a.babyId, b.babyId);
    if (h2h > 0) return [a, b];
    if (h2h < 0) return [b, a];
    return shuffle(group, ctx.rng);
  }

  // 3+ tied on score: tally within-group head-to-head, then randomize
  // whatever's still tied after that.
  const tally = new Map<BabyId, number>();
  for (const entry of group) {
    let wins = 0;
    for (const other of group) {
      if (other.babyId === entry.babyId) continue;
      if (ctx.headToHead(entry.babyId, other.babyId) > 0) wins += 1;
    }
    tally.set(entry.babyId, wins);
  }

  const byTallyDesc = [...group].sort((a, b) => tally.get(b.babyId)! - tally.get(a.babyId)!);

  const result: T[] = [];
  let i = 0;
  while (i < byTallyDesc.length) {
    let j = i + 1;
    while (
      j < byTallyDesc.length &&
      tally.get(byTallyDesc[j]!.babyId) === tally.get(byTallyDesc[i]!.babyId)
    ) {
      j += 1;
    }
    result.push(...shuffle(byTallyDesc.slice(i, j), ctx.rng));
    i = j;
  }
  return result;
}

/** Fisher-Yates using the injected RNG, so tests can pass a seeded sequence. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
