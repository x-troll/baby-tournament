import type {
  BabyId,
  Phase2MatchId,
  Phase2PlayableMatch,
  Phase2Result,
  Phase2Seeds,
  Placement,
} from "./types";

/**
 * The fixed six-match final-four DAG, exactly as specified — this is data,
 * not a generic double-elimination algorithm. Deliberately has no edge
 * back into GRAND_FINAL: there is no bracket reset. A "7th match" is
 * structurally impossible here, not just discouraged by convention.
 *
 *   QF1: seed1 v seed4        QF2: seed2 v seed3
 *          \                        /
 *      loser        winner   winner        loser
 *         \             \    /             /
 *          LOSERS_R1      WINNERS_FINAL
 *        (loser naps 4th)      |
 *              \          winner (-> straight to grand final)
 *             winner            \
 *                \                \
 *                 LOSERS_FINAL (loser of winners final vs winner of losers r1)
 *                 (loser naps 3rd)
 *                        \
 *                       winner
 *                          \
 *                       GRAND_FINAL (winner of winners final vs winner of losers final)
 *                       winner = Best Baby, loser = 2nd. One match, no reset.
 */
export function getPlayablePhase2Matches(
  seeds: Phase2Seeds,
  results: Phase2Result[],
): Phase2PlayableMatch[] {
  const resultOf = (id: Phase2MatchId) => results.find((r) => r.matchId === id);
  const playable: Phase2PlayableMatch[] = [];

  const qf1 = resultOf("QF1");
  const qf2 = resultOf("QF2");

  if (!qf1) playable.push({ matchId: "QF1", babyA: seeds.seed1, babyB: seeds.seed4 });
  if (!qf2) playable.push({ matchId: "QF2", babyA: seeds.seed2, babyB: seeds.seed3 });

  if (qf1 && qf2) {
    if (!resultOf("LOSERS_R1")) {
      playable.push({ matchId: "LOSERS_R1", babyA: qf1.loser, babyB: qf2.loser });
    }
    if (!resultOf("WINNERS_FINAL")) {
      playable.push({ matchId: "WINNERS_FINAL", babyA: qf1.winner, babyB: qf2.winner });
    }
  }

  const winnersFinal = resultOf("WINNERS_FINAL");
  const losersR1 = resultOf("LOSERS_R1");
  if (winnersFinal && losersR1 && !resultOf("LOSERS_FINAL")) {
    playable.push({
      matchId: "LOSERS_FINAL",
      babyA: winnersFinal.loser,
      babyB: losersR1.winner,
    });
  }

  const losersFinal = resultOf("LOSERS_FINAL");
  if (winnersFinal && losersFinal && !resultOf("GRAND_FINAL")) {
    playable.push({
      matchId: "GRAND_FINAL",
      babyA: winnersFinal.winner,
      babyB: losersFinal.winner,
    });
  }

  return playable;
}

export function isPhase2Complete(results: Phase2Result[]): boolean {
  return results.some((r) => r.matchId === "GRAND_FINAL");
}

/**
 * Returns whatever placements are determined so far — 4th resolves as
 * soon as LOSERS_R1 is in, 3rd as soon as LOSERS_FINAL is in, 1st/2nd
 * once GRAND_FINAL is in. Never returns a placement before its
 * determining match has a result.
 */
export function computePhase2Placements(results: Phase2Result[]): Placement[] {
  const resultOf = (id: Phase2MatchId) => results.find((r) => r.matchId === id);
  const placements: Placement[] = [];

  const losersR1 = resultOf("LOSERS_R1");
  if (losersR1) placements.push({ babyId: losersR1.loser, place: 4 });

  const losersFinal = resultOf("LOSERS_FINAL");
  if (losersFinal) placements.push({ babyId: losersFinal.loser, place: 3 });

  const grandFinal = resultOf("GRAND_FINAL");
  if (grandFinal) {
    placements.push({ babyId: grandFinal.winner, place: 1 });
    placements.push({ babyId: grandFinal.loser, place: 2 });
  }

  return placements;
}

/** All valid babyIds a seed set contains, for test enumeration convenience. */
export function seedList(seeds: Phase2Seeds): BabyId[] {
  return [seeds.seed1, seeds.seed2, seeds.seed3, seeds.seed4];
}
