import { describe, expect, it } from "vitest";
import { assignEliminatedPlacements } from "@/lib/bracket-engine";
import type { EliminatedRoundEntry } from "@/lib/bracket-engine";

describe("assignEliminatedPlacements", () => {
  it("assigns the correct place range for a round that shrinks 12 -> 8 (4 nappers -> places 9-12)", () => {
    const eliminated: EliminatedRoundEntry[] = [
      { babyId: "a", penSize: 4, penPosition: 3, tiebreakOrder: 1 }, // score 1
      { babyId: "b", penSize: 4, penPosition: 4, tiebreakOrder: 2 }, // score 0 (worst pen finish)
      { babyId: "c", penSize: 4, penPosition: 3, tiebreakOrder: 3 }, // score 1, tied with a
      { babyId: "d", penSize: 4, penPosition: 4, tiebreakOrder: 4 }, // score 0, tied with b
    ];
    const placements = assignEliminatedPlacements(eliminated, 12);
    expect(new Set(placements.values())).toEqual(new Set([9, 10, 11, 12]));
    // better pen performance (score 1: a, c) ranks ahead of worse (score 0: b, d)
    expect(placements.get("a")!).toBeLessThan(placements.get("b")!);
    expect(placements.get("c")!).toBeLessThan(placements.get("d")!);
  });

  it("breaks equal pen performance by tiebreakOrder, deterministically (never random)", () => {
    const eliminated: EliminatedRoundEntry[] = [
      { babyId: "later", penSize: 3, penPosition: 3, tiebreakOrder: 5 },
      { babyId: "earlier", penSize: 3, penPosition: 3, tiebreakOrder: 2 },
    ];
    const placements = assignEliminatedPlacements(eliminated, 6);
    expect(placements.get("earlier")!).toBeLessThan(placements.get("later")!);

    // Deterministic: running it again gives the exact same result.
    const again = assignEliminatedPlacements(eliminated, 6);
    expect(again.get("earlier")).toBe(placements.get("earlier"));
    expect(again.get("later")).toBe(placements.get("later"));
  });

  it("handles a single napper from a 3-pen cleanly", () => {
    const placements = assignEliminatedPlacements(
      [{ babyId: "only", penSize: 3, penPosition: 3, tiebreakOrder: 1 }],
      9,
    );
    expect(placements.get("only")).toBe(9);
  });

  it("returns an empty map for an empty cohort", () => {
    expect(assignEliminatedPlacements([], 10).size).toBe(0);
  });

  it("throws if more babies are eliminated than were alive", () => {
    expect(() =>
      assignEliminatedPlacements(
        [
          { babyId: "a", penSize: 3, penPosition: 3, tiebreakOrder: 1 },
          { babyId: "b", penSize: 3, penPosition: 3, tiebreakOrder: 2 },
        ],
        1,
      ),
    ).toThrow();
  });
});
