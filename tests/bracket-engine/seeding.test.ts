import { describe, expect, it } from "vitest";
import { computeSeedingScore, buildHeadToHeadIndex } from "@/lib/bracket-engine";
import type { PenResult } from "@/lib/bracket-engine";

// Deterministic RNG sequence for reproducible random-tiebreak assertions.
function seededRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length]!;
}

describe("computeSeedingScore — the points formula", () => {
  it("scores 1st in a 4-pen as 3, 2nd as 2, 3rd as 1, 4th as 0", () => {
    const pen: PenResult = { penId: "p1", size: 4, finishOrder: ["a", "b", "c", "d"] };
    const scores = computeSeedingScore(["a", "b", "c", "d"], [pen]);
    expect(scores.find((s) => s.babyId === "a")!.score).toBe(3);
    expect(scores.find((s) => s.babyId === "b")!.score).toBe(2);
    expect(scores.find((s) => s.babyId === "c")!.score).toBe(1);
    expect(scores.find((s) => s.babyId === "d")!.score).toBe(0);
  });

  it("scores 1st in a 3-pen as 2, 2nd as 1, 3rd as 0 (self-normalising, no separate table)", () => {
    const pen: PenResult = { penId: "p1", size: 3, finishOrder: ["a", "b", "c"] };
    const scores = computeSeedingScore(["a", "b", "c"], [pen]);
    expect(scores.find((s) => s.babyId === "a")!.score).toBe(2);
    expect(scores.find((s) => s.babyId === "b")!.score).toBe(1);
    expect(scores.find((s) => s.babyId === "c")!.score).toBe(0);
  });

  it("sums across every pen played, across rounds", () => {
    const pens: PenResult[] = [
      { penId: "r1p1", size: 4, finishOrder: ["a", "b", "c", "d"] }, // a: 3
      { penId: "r2p1", size: 3, finishOrder: ["a", "e", "f"] }, // a: 2
    ];
    const scores = computeSeedingScore(["a"], pens);
    expect(scores[0]!.score).toBe(5);
  });

  it("scores a baby with no recorded pens as 0 (e.g. a bye round)", () => {
    const scores = computeSeedingScore(["byeBaby"], []);
    expect(scores[0]!.score).toBe(0);
  });

  it("assigns seed 1..N by descending score", () => {
    const pen: PenResult = { penId: "p1", size: 4, finishOrder: ["a", "b", "c", "d"] };
    const scores = computeSeedingScore(["a", "b", "c", "d"], [pen]);
    const byBaby = Object.fromEntries(scores.map((s) => [s.babyId, s.seed]));
    expect(byBaby).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });
});

describe("computeSeedingScore — tiebreaks", () => {
  it("breaks a 2-way tie via head-to-head when the tied babies played each other", () => {
    // a and b finish on equal totals overall, but a beat b directly in one
    // shared pen — that's the deciding signal. (The shared pen itself
    // necessarily splits their score by 1, so b needs one extra point
    // from elsewhere to bring the totals back level.)
    const pens: PenResult[] = [
      { penId: "solo-a", size: 3, finishOrder: ["a", "x", "y"] }, // a: 2
      { penId: "solo-b-1", size: 3, finishOrder: ["b", "z", "w"] }, // b: 2
      { penId: "solo-b-2", size: 2, finishOrder: ["b", "v"] }, // b: +1
      { penId: "head-to-head", size: 4, finishOrder: ["a", "b", "q", "r"] }, // a:3 b:2, a beat b here
    ];
    const scores = computeSeedingScore(["a", "b"], pens);
    const a = scores.find((s) => s.babyId === "a")!;
    const b = scores.find((s) => s.babyId === "b")!;
    expect(a.score).toBe(b.score); // confirms they really are tied on points
    expect(a.seed).toBeLessThan(b.seed); // a ranked above b via head-to-head
  });

  it("falls back to random when tied babies never played each other, deterministically per RNG", () => {
    const pens: PenResult[] = [
      { penId: "p1", size: 3, finishOrder: ["a", "x", "y"] }, // a: 2
      { penId: "p2", size: 3, finishOrder: ["b", "z", "w"] }, // b: 2, never met a
    ];
    const scoresRun1 = computeSeedingScore(["a", "b"], pens, seededRng([0]));
    expect(scoresRun1.find((s) => s.babyId === "a")!.score).toBe(
      scoresRun1.find((s) => s.babyId === "b")!.score,
    );
    // Same RNG seed => same result both times (determinism, not "some randomness").
    const scoresRun2 = computeSeedingScore(["a", "b"], pens, seededRng([0]));
    expect(scoresRun2.map((s) => s.babyId)).toEqual(scoresRun1.map((s) => s.babyId));
  });

  it("resolves a 3-way tie by within-group head-to-head tally before falling to random", () => {
    // a, b, c all finish on 2 points, but a beat both b and c directly in
    // the shared 3-pen — a should rank first without needing randomness.
    // (A 2-pen only awards 1 point to 1st place — size(2) minus position(1)
    // — so c needs two 2-pen wins to reach the same total as b's one.)
    const finalPens: PenResult[] = [
      { penId: "shared-pen", size: 3, finishOrder: ["a", "b", "c"] }, // a:2 b:1 c:0
      { penId: "topup-b", size: 2, finishOrder: ["b", "n1"] }, // b: +1 -> 2
      { penId: "topup-c-1", size: 2, finishOrder: ["c", "n2"] }, // c: +1 -> 1
      { penId: "topup-c-2", size: 2, finishOrder: ["c", "n3"] }, // c: +1 -> 2
    ];

    const scores = computeSeedingScore(["a", "b", "c"], finalPens);
    const a = scores.find((s) => s.babyId === "a")!;
    const b = scores.find((s) => s.babyId === "b")!;
    const c = scores.find((s) => s.babyId === "c")!;
    expect([a.score, b.score, c.score]).toEqual([2, 2, 2]);
    // a beat both b and c in the shared pen -> highest within-group tally -> ranked first
    expect(a.seed).toBe(1);
  });
});

describe("buildHeadToHeadIndex", () => {
  it("is antisymmetric and zero for babies who never shared a pen", () => {
    const pens: PenResult[] = [{ penId: "p1", size: 3, finishOrder: ["a", "b", "c"] }];
    const h2h = buildHeadToHeadIndex(pens);
    expect(h2h("a", "b")).toBeGreaterThan(0);
    expect(h2h("b", "a")).toBe(-h2h("a", "b"));
    expect(h2h("a", "z")).toBe(0);
  });
});
