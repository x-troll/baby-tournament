import { describe, expect, it } from "vitest";
import { computeRoundRobinStandings, generateRoundRobinFixtures } from "@/lib/bracket-engine";

function seededRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length]!;
}

describe("generateRoundRobinFixtures — N=3 start-only special case", () => {
  it("produces exactly the 3 pairings, each meeting once", () => {
    const fixtures = generateRoundRobinFixtures(["a", "b", "c"]);
    expect(fixtures).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
  });
});

describe("computeRoundRobinStandings — most gold stars wins", () => {
  it("ranks by win count with a clean sweep", () => {
    const standings = computeRoundRobinStandings(
      ["a", "b", "c"],
      [
        { winner: "a", loser: "b" },
        { winner: "a", loser: "c" },
        { winner: "b", loser: "c" },
      ],
    );
    expect(standings.find((p) => p.babyId === "a")!.place).toBe(1);
    expect(standings.find((p) => p.babyId === "b")!.place).toBe(2);
    expect(standings.find((p) => p.babyId === "c")!.place).toBe(3);
  });

  // Note: a 3-game round-robin among 3 players is mathematically either
  // fully transitive (win counts 2/1/0, all distinct — "clean sweep"
  // above) or a full 3-way cycle (1/1/1, all tied). There's no way to
  // construct a *clean 2-way* tie in this shape — any two players who are
  // tied are always tied with the third too. The cyclic case below is
  // exactly where head-to-head (via the shared tiebreak.ts group tally)
  // matters here.

  it("falls to a deterministic random ordering for a 3-way cyclic tie (A>B>C>A)", () => {
    const results = [
      { winner: "a", loser: "b" },
      { winner: "b", loser: "c" },
      { winner: "c", loser: "a" },
    ];
    const run1 = computeRoundRobinStandings(["a", "b", "c"], results, seededRng([0.9, 0.1]));
    const run2 = computeRoundRobinStandings(["a", "b", "c"], results, seededRng([0.9, 0.1]));
    expect(run1.map((p) => p.babyId)).toEqual(run2.map((p) => p.babyId));
    // every baby still gets a distinct place 1-3
    expect(run1.map((p) => p.place).sort()).toEqual([1, 2, 3]);
  });
});
