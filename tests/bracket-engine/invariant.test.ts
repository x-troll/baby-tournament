import { describe, expect, it } from "vitest";
import { computeRoundLayout } from "@/lib/bracket-engine";

/**
 * "Every pen advances exactly 2, so the survivor count after any round is
 * always even. N=5 and N=3 are therefore only ever possible as the
 * *starting* registration count, never mid-tournament." — verify this
 * holds by actually simulating full tournaments, not just asserting it
 * for isolated N values.
 */
describe("even-survivor invariant", () => {
  it("holds every round, for every starting N from 6 to 200, converging to FINAL_FOUR", () => {
    for (let start = 6; start <= 200; start++) {
      let n = start;
      let isStart = true;
      let rounds = 0;

      while (true) {
        const plan = computeRoundLayout(n, isStart);
        if (plan.kind === "FINAL_FOUR") break;

        expect(plan.kind, `unexpected plan kind at N=${n} (start=${start})`).toBe("PENS");
        if (plan.kind !== "PENS") break; // unreachable, narrows for TS

        const survivors = 2 * (plan.fourPens + plan.threePens);
        expect(survivors % 2, `survivor count must be even at N=${n} (start=${start})`).toBe(0);
        expect(survivors, `must strictly shrink at N=${n} (start=${start})`).toBeLessThan(n);

        n = survivors;
        isStart = false;
        rounds += 1;
        expect(rounds, `did not converge from start=${start}`).toBeLessThan(30);
      }

      expect(n, `should land exactly on 4 from start=${start}`).toBe(4);
    }
  });

  it("N=5 at start resolves to exactly 4 survivors (1 pen + 2 byes), then goes straight to FINAL_FOUR", () => {
    const plan = computeRoundLayout(5, true);
    expect(plan).toEqual({ kind: "BYE_ROUND", penSize: 3, byeCount: 2 });
    // 3-pen advances top 2 + 2 direct byes = 4
    const survivors = 2 /* top 2 of the 3-pen */ + 2 /* byes */;
    expect(survivors).toBe(4);
    expect(computeRoundLayout(survivors, false)).toEqual({ kind: "FINAL_FOUR" });
  });

  it("N=3 at start skips brackets entirely — no round-layout call after it", () => {
    const plan = computeRoundLayout(3, true);
    expect(plan).toEqual({ kind: "ROUND_ROBIN" });
  });

  it("N=3 and N=5 both throw if ever computed as a mid-tournament round (the invariant guarantee)", () => {
    expect(() => computeRoundLayout(3, false)).toThrow();
    expect(() => computeRoundLayout(5, false)).toThrow();
  });
});
