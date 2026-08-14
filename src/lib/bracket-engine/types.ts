// Pure structural types for the bracket engine. No DB/React imports, no
// themed copy — the UI layer supplies "baby"/"playpen"/"gold star" etc.
// See PLAN.md for the full design rationale.

/** Opaque player identifier — doesn't have to be a real DB id for the engine to work. */
export type BabyId = string;

// ── Round layout (Phase 1: playpens) ─────────────────────────────────

export type RoundPlan =
  /** N=3 at tournament start only: skip brackets entirely, round-robin decides the whole thing. */
  | { kind: "ROUND_ROBIN" }
  /** N=5 at tournament start only: one 3-pen (bottom naps) + 2 direct byes. */
  | { kind: "BYE_ROUND"; penSize: 3; byeCount: 2 }
  /** N=4: stop laying out pens, move to Phase 2. */
  | { kind: "FINAL_FOUR" }
  /** General case: solved via 4a + 3b = N, maximizing 4-pens. */
  | { kind: "PENS"; fourPens: number; threePens: number };

export interface PenAssignment {
  penIndex: number;
  babyIds: BabyId[];
}

/** How a single pen resolves after any no-show shrinkage, independent of its original size. */
export type PenResolution =
  | { kind: "PLAYS"; babyIds: BabyId[] } // 3+ remain — plays normally, top 2 advance
  | { kind: "AUTO_ADVANCE"; advancing: [BabyId, BabyId] } // shrank to 2 — both advance, no match needed
  | { kind: "BYE"; advancing: [BabyId] } // shrank to 1 — advances as a bye
  | { kind: "EMPTY" }; // shrank to 0 — degenerate edge case

// ── Seeding score (into the final four) ──────────────────────────────

export interface PenResult {
  penId: string;
  size: number;
  /** Finishing order, index 0 = 1st place. */
  finishOrder: BabyId[];
}

export interface SeedEntry {
  babyId: BabyId;
  score: number;
  /** 1-based rank after tiebreaks, across the babies passed in. */
  seed: number;
}

// ── Round-robin (N=3 start-only special case) ────────────────────────

export interface RoundRobinResult {
  winner: BabyId;
  loser: BabyId;
}

export interface Placement {
  babyId: BabyId;
  place: number; // 1-based, 1 = Best Baby
}

// ── Phase 2: final four, 1v1 double elimination, no bracket reset ────

export type Phase2MatchId =
  | "QF1"
  | "QF2"
  | "LOSERS_R1"
  | "WINNERS_FINAL"
  | "LOSERS_FINAL"
  | "GRAND_FINAL";

export interface Phase2Seeds {
  seed1: BabyId;
  seed2: BabyId;
  seed3: BabyId;
  seed4: BabyId;
}

export interface Phase2Result {
  matchId: Phase2MatchId;
  winner: BabyId;
  loser: BabyId;
}

export interface Phase2PlayableMatch {
  matchId: Phase2MatchId;
  babyA: BabyId;
  babyB: BabyId;
}

// ── Match lifecycle ────────────────────────────────────────────────

export type MatchStatus = "PENDING" | "READY" | "IN_PROGRESS" | "CONFIRMED";
