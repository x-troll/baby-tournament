// Maps Phase 2's fixed six-match DAG (see bracket-engine/phase2.ts) onto
// @g-loot/react-tournament-brackets' { upper, lower } shape, so the
// spectator screen can render it as an actual bracket instead of a flat
// match list. Pure data transform, no React — shared by the initial
// server render and the poll endpoint via computeSpectatorState.
import type { MatchKind, MatchStatus } from "@/generated/prisma/enums";
// Type-only import — no runtime cost in this server module, but keeps our
// shape provably assignable to what <DoubleEliminationBracket> expects.
import type { MatchType } from "@g-loot/react-tournament-brackets";

export interface Phase2BracketParticipant {
  babyId: string;
  name: string;
  finishPosition: number | null;
}

export interface Phase2BracketMatchInput {
  kind: MatchKind;
  status: MatchStatus;
  participants: Phase2BracketParticipant[];
}

export interface Phase2BracketData {
  upper: MatchType[];
  lower: MatchType[];
}

const PHASE2_KINDS = new Set<MatchKind>([
  "QF1",
  "QF2",
  "LOSERS_R1",
  "WINNERS_FINAL",
  "LOSERS_FINAL",
  "GRAND_FINAL",
] as MatchKind[]);

const LABELS: Record<string, string> = {
  QF1: "Quarterfinal 1",
  QF2: "Quarterfinal 2",
  LOSERS_R1: "Losers round 1",
  WINNERS_FINAL: "Winners final",
  LOSERS_FINAL: "Losers final",
  GRAND_FINAL: "Grand final",
};

const DAG: Record<
  string,
  { bracket: "upper" | "lower"; nextMatchId: string | null; nextLooserMatchId: string | null }
> = {
  QF1: { bracket: "upper", nextMatchId: "WINNERS_FINAL", nextLooserMatchId: "LOSERS_R1" },
  QF2: { bracket: "upper", nextMatchId: "WINNERS_FINAL", nextLooserMatchId: "LOSERS_R1" },
  WINNERS_FINAL: { bracket: "upper", nextMatchId: "GRAND_FINAL", nextLooserMatchId: "LOSERS_FINAL" },
  GRAND_FINAL: { bracket: "upper", nextMatchId: null, nextLooserMatchId: null },
  LOSERS_R1: { bracket: "lower", nextMatchId: "LOSERS_FINAL", nextLooserMatchId: null },
  LOSERS_FINAL: { bracket: "lower", nextMatchId: "GRAND_FINAL", nextLooserMatchId: null },
};

/**
 * Builds the double-elimination bracket view, or `null` if Phase 2 hasn't
 * started yet (still in playpens, or the N=3 round-robin path that never
 * reaches Phase 2 at all). Matches not yet created in the DB (their
 * feeder matches haven't resolved) render as TBD placeholders so the
 * whole six-match shape is always visible, not just what exists so far.
 */
export function buildPhase2Bracket(matches: Phase2BracketMatchInput[]): Phase2BracketData | null {
  const byKind = new Map(matches.filter((m) => PHASE2_KINDS.has(m.kind)).map((m) => [m.kind as string, m]));
  if (!byKind.has("QF1") && !byKind.has("QF2")) return null;

  const toMatchType = (kind: string): MatchType => {
    const node = DAG[kind]!;
    const match = byKind.get(kind);
    const done = match?.status === "CONFIRMED";

    const participants: { id: string; name?: string; isWinner: boolean }[] = (match?.participants ?? []).map(
      (p) => ({ id: p.babyId, name: p.name, isWinner: p.finishPosition === 1 }),
    );
    // Pad to 2 slots with TBD placeholders — keeps the bracket's shape
    // fixed even before a match's feeders have resolved.
    while (participants.length < 2) {
      participants.push({ id: `${kind}-tbd-${participants.length}`, isWinner: false });
    }

    return {
      id: kind,
      name: LABELS[kind]!,
      nextMatchId: node.nextMatchId,
      nextLooserMatchId: node.nextLooserMatchId ?? undefined,
      tournamentRoundText: LABELS[kind]!,
      startTime: "",
      state: done ? "DONE" : "SCHEDULED",
      participants,
    };
  };

  return {
    upper: ["QF1", "QF2", "WINNERS_FINAL", "GRAND_FINAL"].map(toMatchType),
    lower: ["LOSERS_R1", "LOSERS_FINAL"].map(toMatchType),
  };
}
