import { describe, expect, it } from "vitest";
import {
  computePhase2Placements,
  getPlayablePhase2Matches,
  isPhase2Complete,
} from "@/lib/bracket-engine";
import type { Phase2Result, Phase2Seeds } from "@/lib/bracket-engine";

const SEEDS: Phase2Seeds = { seed1: "s1", seed2: "s2", seed3: "s3", seed4: "s4" };
const ALL_MATCH_IDS = [
  "QF1",
  "QF2",
  "LOSERS_R1",
  "WINNERS_FINAL",
  "LOSERS_FINAL",
  "GRAND_FINAL",
] as const;

/**
 * Plays out one full path through the fixed 6-match DAG, driven entirely
 * through the public API (getPlayablePhase2Matches / isPhase2Complete) —
 * this exercises the DAG-discovery logic itself, not just a hand-written
 * bracket. `mask` supplies one bit per decision, consumed in the order
 * matches become playable; QF1+QF2 are simultaneously playable so they
 * consume 2 bits in the same pass, same for LOSERS_R1+WINNERS_FINAL.
 */
function playPath(seeds: Phase2Seeds, mask: number): Phase2Result[] {
  const results: Phase2Result[] = [];
  let bit = 0;
  let guard = 0;

  while (!isPhase2Complete(results)) {
    const playable = getPlayablePhase2Matches(seeds, results);
    expect(playable.length, "should always have something playable until complete").toBeGreaterThan(0);

    for (const match of playable) {
      const chooseA = ((mask >> bit) & 1) === 0;
      bit += 1;
      results.push({
        matchId: match.matchId,
        winner: chooseA ? match.babyA : match.babyB,
        loser: chooseA ? match.babyB : match.babyA,
      });
    }

    guard += 1;
    if (guard > 10) throw new Error("playPath did not converge — possible infinite loop in the DAG");
  }

  return results;
}

describe("Phase 2 — QF1 and QF2 are the only matches playable before either resolves", () => {
  it("offers exactly QF1 and QF2 at the start", () => {
    const playable = getPlayablePhase2Matches(SEEDS, []);
    expect(playable.map((m) => m.matchId).sort()).toEqual(["QF1", "QF2"]);
    expect(playable.find((m) => m.matchId === "QF1")).toEqual({
      matchId: "QF1",
      babyA: "s1",
      babyB: "s4",
    });
    expect(playable.find((m) => m.matchId === "QF2")).toEqual({
      matchId: "QF2",
      babyA: "s2",
      babyB: "s3",
    });
  });

  it("offers nothing new from LOSERS_R1/WINNERS_FINAL until both QFs are done", () => {
    const afterQf1Only: Phase2Result[] = [{ matchId: "QF1", winner: "s1", loser: "s4" }];
    const playable = getPlayablePhase2Matches(SEEDS, afterQf1Only);
    expect(playable.map((m) => m.matchId)).toEqual(["QF2"]);
  });
});

describe("Phase 2 — full 64-path matrix (all win/loss combinations through the DAG)", () => {
  for (let mask = 0; mask < 64; mask++) {
    it(`mask=${mask}: resolves to exactly 6 matches, 4 distinct placements, no bracket reset`, () => {
      const results = playPath(SEEDS, mask);

      expect(results).toHaveLength(6);
      expect(results.map((r) => r.matchId).sort()).toEqual([...ALL_MATCH_IDS].sort());

      const placements = computePhase2Placements(results);
      expect(placements).toHaveLength(4);
      expect(placements.map((p) => p.place).sort()).toEqual([1, 2, 3, 4]);
      expect(new Set(placements.map((p) => p.babyId)).size).toBe(4);
      expect(new Set(placements.map((p) => p.babyId))).toEqual(new Set(["s1", "s2", "s3", "s4"]));

      // No bracket reset: once GRAND_FINAL has a result, nothing is ever
      // playable again — structurally, not by convention.
      expect(getPlayablePhase2Matches(SEEDS, results)).toEqual([]);

      // 1st place is exactly the GRAND_FINAL winner, no other path to 1st.
      const grandFinal = results.find((r) => r.matchId === "GRAND_FINAL")!;
      expect(placements.find((p) => p.place === 1)!.babyId).toBe(grandFinal.winner);
      expect(placements.find((p) => p.place === 2)!.babyId).toBe(grandFinal.loser);
    });
  }
});

describe("Phase 2 — named illustrative paths", () => {
  it("top seed wins straight through the winners side", () => {
    const results = playPath(SEEDS, 0b000000); // every "chooseA" -> higher seed wins every match it's favoured in
    const placements = computePhase2Placements(results);
    expect(placements.find((p) => p.place === 1)!.babyId).toBe("s1");
  });

  it("a seed can come back through the losers side to win it all (that's the point of double elimination here)", () => {
    // QF1: s4 upsets s1 (chooseB). QF2: s2 beats s3 (chooseA).
    // -> LOSERS_R1: s1 vs s3, WINNERS_FINAL: s4 vs s2 (order per getPlayablePhase2Matches).
    let mask = 0;
    mask |= 1 << 0; // QF1 -> babyB (s4) wins
    mask |= 0 << 1; // QF2 -> babyA (s2) wins
    // LOSERS_R1: loser(QF1)=s1 vs loser(QF2)=s3 -> s1 wins (chooseA)
    mask |= 0 << 2;
    // WINNERS_FINAL: winner(QF1)=s4 vs winner(QF2)=s2 -> s2 wins (chooseB)
    mask |= 1 << 3;
    // LOSERS_FINAL: loser(WINNERS_FINAL)=s4 vs winner(LOSERS_R1)=s1 -> s1 wins (chooseB, s1 is babyB)
    mask |= 1 << 4;
    // GRAND_FINAL: winner(WINNERS_FINAL)=s2 vs winner(LOSERS_FINAL)=s1 -> s1 wins (chooseB)
    mask |= 1 << 5;

    const results = playPath(SEEDS, mask);
    const placements = computePhase2Placements(results);
    expect(placements.find((p) => p.place === 1)!.babyId).toBe("s1");
    expect(results.find((r) => r.matchId === "LOSERS_R1")!.loser).toBe("s3"); // 4th place, napped first
    expect(placements.find((p) => p.place === 4)!.babyId).toBe("s3");
  });
});
