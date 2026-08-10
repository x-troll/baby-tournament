import { describe, expect, it } from "vitest";
import { isValidTransition, resolveEffectiveStatus } from "@/lib/bracket-engine";
import type { MatchStatus } from "@/lib/bracket-engine";

const ALL_STATUSES: MatchStatus[] = ["PENDING", "READY", "IN_PROGRESS", "REPORTED", "CONFIRMED"];

describe("isValidTransition", () => {
  it("allows exactly the spec's lifecycle: pending -> ready -> in_progress -> reported -> confirmed", () => {
    expect(isValidTransition("PENDING", "READY")).toBe(true);
    expect(isValidTransition("READY", "IN_PROGRESS")).toBe(true);
    expect(isValidTransition("IN_PROGRESS", "REPORTED")).toBe(true);
    expect(isValidTransition("REPORTED", "CONFIRMED")).toBe(true);
  });

  it("has no transitions out of CONFIRMED (terminal) and no skipping stages", () => {
    for (const to of ALL_STATUSES) {
      expect(isValidTransition("CONFIRMED", to)).toBe(false);
    }
    expect(isValidTransition("PENDING", "IN_PROGRESS")).toBe(false);
    expect(isValidTransition("PENDING", "CONFIRMED")).toBe(false);
    expect(isValidTransition("READY", "REPORTED")).toBe(false);
  });

  it("has no transitions backward", () => {
    expect(isValidTransition("READY", "PENDING")).toBe(false);
    expect(isValidTransition("CONFIRMED", "REPORTED")).toBe(false);
  });
});

describe("resolveEffectiveStatus — lazy auto-confirm", () => {
  it("leaves a REPORTED match alone before its deadline", () => {
    const now = new Date("2026-08-10T20:00:00Z");
    const deadline = new Date("2026-08-10T20:01:00Z");
    const result = resolveEffectiveStatus({ status: "REPORTED", deadlineAt: deadline }, now);
    expect(result).toEqual({ status: "REPORTED", autoTransitioned: false });
  });

  it("auto-confirms once now has passed the deadline, without any scheduled job", () => {
    const deadline = new Date("2026-08-10T20:01:00Z");
    const now = new Date("2026-08-10T20:01:00.001Z");
    const result = resolveEffectiveStatus({ status: "REPORTED", deadlineAt: deadline }, now);
    expect(result).toEqual({ status: "CONFIRMED", autoTransitioned: true });
  });

  it("auto-confirms exactly at the deadline instant (>=, not >)", () => {
    const deadline = new Date("2026-08-10T20:01:00Z");
    const result = resolveEffectiveStatus({ status: "REPORTED", deadlineAt: deadline }, deadline);
    expect(result.autoTransitioned).toBe(true);
  });

  it("is a no-op for statuses other than REPORTED, even with a past deadline", () => {
    const now = new Date("2026-08-10T21:00:00Z");
    const pastDeadline = new Date("2026-08-10T20:00:00Z");
    for (const status of ["PENDING", "READY", "IN_PROGRESS", "CONFIRMED"] as MatchStatus[]) {
      const result = resolveEffectiveStatus({ status, deadlineAt: pastDeadline }, now);
      expect(result).toEqual({ status, autoTransitioned: false });
    }
  });

  it("is a no-op when REPORTED but no deadline was ever set", () => {
    const result = resolveEffectiveStatus({ status: "REPORTED", deadlineAt: null }, new Date());
    expect(result).toEqual({ status: "REPORTED", autoTransitioned: false });
  });
});
