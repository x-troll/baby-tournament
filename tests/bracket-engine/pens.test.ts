import { describe, expect, it } from "vitest";
import {
  assignBabiesToPens,
  computeByeRoundAssignment,
  computeRoundLayout,
  resolvePenAfterNoShows,
  solveFourThreeSplit,
} from "@/lib/bracket-engine";

// The verified N=3..40 table from PLAN.md, transcribed independently of
// the implementation (computed by a standalone script, not copy-pasted
// from pens.ts) so this test actually catches a broken solver.
const EXPECTED_GENERIC: Record<number, { fourPens: number; threePens: number }> = {
  6: { fourPens: 0, threePens: 2 },
  7: { fourPens: 1, threePens: 1 },
  8: { fourPens: 2, threePens: 0 },
  9: { fourPens: 0, threePens: 3 },
  10: { fourPens: 1, threePens: 2 },
  11: { fourPens: 2, threePens: 1 },
  12: { fourPens: 3, threePens: 0 },
  13: { fourPens: 1, threePens: 3 },
  14: { fourPens: 2, threePens: 2 },
  15: { fourPens: 3, threePens: 1 },
  16: { fourPens: 4, threePens: 0 },
  17: { fourPens: 2, threePens: 3 },
  18: { fourPens: 3, threePens: 2 },
  19: { fourPens: 4, threePens: 1 },
  20: { fourPens: 5, threePens: 0 },
  21: { fourPens: 3, threePens: 3 },
  22: { fourPens: 4, threePens: 2 },
  23: { fourPens: 5, threePens: 1 },
  24: { fourPens: 6, threePens: 0 },
  25: { fourPens: 4, threePens: 3 },
  26: { fourPens: 5, threePens: 2 },
  27: { fourPens: 6, threePens: 1 },
  28: { fourPens: 7, threePens: 0 },
  29: { fourPens: 5, threePens: 3 },
  30: { fourPens: 6, threePens: 2 },
  31: { fourPens: 7, threePens: 1 },
  32: { fourPens: 8, threePens: 0 },
  33: { fourPens: 6, threePens: 3 },
  34: { fourPens: 7, threePens: 2 },
  35: { fourPens: 8, threePens: 1 },
  36: { fourPens: 9, threePens: 0 },
  37: { fourPens: 7, threePens: 3 },
  38: { fourPens: 8, threePens: 2 },
  39: { fourPens: 9, threePens: 1 },
  40: { fourPens: 10, threePens: 0 },
};

describe("solveFourThreeSplit", () => {
  it("matches the verified table for every generic N (6..40, excluding the 3/4/5 special cases)", () => {
    for (const [n, expected] of Object.entries(EXPECTED_GENERIC)) {
      expect(solveFourThreeSplit(Number(n))).toEqual(expected);
    }
  });

  it("has no exact decomposition for 1, 2, or 5 — exactly why N=5 needs the bye rule", () => {
    expect(solveFourThreeSplit(1)).toBeNull();
    expect(solveFourThreeSplit(2)).toBeNull();
    expect(solveFourThreeSplit(5)).toBeNull();
  });

  it("never produces a pen of 1 or 2 for any N from 6 to 500", () => {
    for (let n = 6; n <= 500; n++) {
      const split = solveFourThreeSplit(n);
      expect(split, `N=${n} should have a solution`).not.toBeNull();
      expect(4 * split!.fourPens + 3 * split!.threePens).toBe(n);
    }
  });
});

describe("computeRoundLayout", () => {
  it("returns ROUND_ROBIN for N=3 at tournament start", () => {
    expect(computeRoundLayout(3, true)).toEqual({ kind: "ROUND_ROBIN" });
  });

  it("returns BYE_ROUND for N=5 at tournament start", () => {
    expect(computeRoundLayout(5, true)).toEqual({ kind: "BYE_ROUND", penSize: 3, byeCount: 2 });
  });

  it("returns FINAL_FOUR for N=4 regardless of start", () => {
    expect(computeRoundLayout(4, true)).toEqual({ kind: "FINAL_FOUR" });
    expect(computeRoundLayout(4, false)).toEqual({ kind: "FINAL_FOUR" });
  });

  it("throws for N=3 mid-tournament (violates the even-survivor invariant)", () => {
    expect(() => computeRoundLayout(3, false)).toThrow(/invariant/);
  });

  it("throws for N=5 mid-tournament (violates the even-survivor invariant)", () => {
    expect(() => computeRoundLayout(5, false)).toThrow(/invariant/);
  });

  it("throws below N=3", () => {
    expect(() => computeRoundLayout(2, true)).toThrow();
    expect(() => computeRoundLayout(0, true)).toThrow();
  });

  it("matches the verified table for every N from 6 to 40, at start and mid-tournament", () => {
    for (const [n, expected] of Object.entries(EXPECTED_GENERIC)) {
      for (const isStart of [true, false]) {
        expect(computeRoundLayout(Number(n), isStart)).toEqual({ kind: "PENS", ...expected });
      }
    }
  });
});

describe("assignBabiesToPens", () => {
  it("distributes ranked babies into pens matching the requested slot sizes", () => {
    const ranked = Array.from({ length: 11 }, (_, i) => `baby-${i + 1}`);
    const pens = assignBabiesToPens(ranked, [4, 4, 3]);
    expect(pens.map((p) => p.babyIds.length)).toEqual([4, 4, 3]);
    // every baby placed exactly once
    const allPlaced = pens.flatMap((p) => p.babyIds);
    expect(new Set(allPlaced).size).toBe(11);
  });

  it("snake-balances strength: rank 1 and the worst ranks don't all land in the same pen", () => {
    const ranked = Array.from({ length: 12 }, (_, i) => `baby-${i + 1}`);
    const pens = assignBabiesToPens(ranked, [4, 4, 4]);
    // rank 1 (best) should not share a pen with rank 2 (next best) under a snake draw
    const penOf = (id: string) => pens.find((p) => p.babyIds.includes(id))!.penIndex;
    expect(penOf("baby-1")).not.toBe(penOf("baby-2"));
  });

  it("throws when baby count doesn't match total pen capacity", () => {
    expect(() => assignBabiesToPens(["a", "b", "c"], [4])).toThrow();
  });
});

describe("computeByeRoundAssignment", () => {
  it("sends the 3 lowest-seeded babies to the pen and byes the top 2", () => {
    const ranked = ["s1", "s2", "s3", "s4", "s5"];
    const { penBabyIds, byeBabyIds } = computeByeRoundAssignment(ranked);
    expect(byeBabyIds).toEqual(["s1", "s2"]);
    expect(penBabyIds).toEqual(["s3", "s4", "s5"]);
  });

  it("throws unless given exactly 5 babies", () => {
    expect(() => computeByeRoundAssignment(["a", "b", "c", "d"])).toThrow();
  });
});

describe("resolvePenAfterNoShows", () => {
  it("plays normally with 3 or 4 remaining", () => {
    expect(resolvePenAfterNoShows(["a", "b", "c"])).toEqual({ kind: "PLAYS", babyIds: ["a", "b", "c"] });
    expect(resolvePenAfterNoShows(["a", "b", "c", "d"])).toEqual({
      kind: "PLAYS",
      babyIds: ["a", "b", "c", "d"],
    });
  });

  it("auto-advances both babies without a match when shrunk to 2", () => {
    expect(resolvePenAfterNoShows(["a", "b"])).toEqual({ kind: "AUTO_ADVANCE", advancing: ["a", "b"] });
  });

  it("advances the lone baby as a bye when shrunk to 1", () => {
    expect(resolvePenAfterNoShows(["a"])).toEqual({ kind: "BYE", advancing: ["a"] });
  });

  it("handles the degenerate empty case without crashing", () => {
    expect(resolvePenAfterNoShows([])).toEqual({ kind: "EMPTY" });
  });
});
