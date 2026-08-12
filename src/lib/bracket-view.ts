// Builds Phase 2 (the fixed six-match final-four DAG — see
// bracket-engine/phase2.ts) into a plain, from-scratch view model for
// src/components/brackets/Phase2Bracket.tsx to render as a small custom
// bracket diagram. No third-party bracket library: one was tried
// (@g-loot/react-tournament-brackets) and dropped — its renderer hard-
// reads exactly two participants per match, which is fine for Phase 2
// (genuinely 1v1) but the peer-dependency/packaging workarounds it
// needed weren't worth it for a diagram this small. Pure data transform,
// no React — shared by the initial server render and the poll endpoint
// via computeSpectatorState, and by the admin page directly.
import type { MatchKind, MatchStatus } from "@/generated/prisma/enums";
import type { DisplayStatus } from "./match-status";

export interface Phase2BracketParticipantInput {
  babyId: string;
  name: string;
  finishPosition: number | null;
  avatarSrc: string | null;
}

export interface Phase2BracketMatchInput {
  kind: MatchKind;
  status: MatchStatus;
  participants: Phase2BracketParticipantInput[];
}

export type Phase2BoxStatus = DisplayStatus;

export interface Phase2BoxParticipant {
  babyId: string | null;
  /** null → genuinely unknown yet (render "????"), not just unnamed. */
  name: string | null;
  isWinner: boolean;
  avatarSrc: string | null;
}

export interface Phase2Box {
  kind: string;
  label: string;
  status: Phase2BoxStatus;
  /** Purely for layout — two visual tracks so QF1→WINNERS_FINAL and QF2→LOSERS_R1 read as distinct paths that later merge. */
  row: "a" | "b";
  col: 1 | 2 | 3 | 4;
  participants: [Phase2BoxParticipant, Phase2BoxParticipant];
}

export interface Phase2BracketData {
  boxes: Phase2Box[];
}

const STAGES: { kind: MatchKind; label: string; row: "a" | "b"; col: 1 | 2 | 3 | 4 }[] = [
  { kind: "QF1" as MatchKind, label: "Playpen 1", row: "a", col: 1 },
  { kind: "QF2" as MatchKind, label: "Playpen 2", row: "b", col: 1 },
  { kind: "WINNERS_FINAL" as MatchKind, label: "Winner playpen", row: "a", col: 2 },
  { kind: "LOSERS_R1" as MatchKind, label: "Losers playpen", row: "b", col: 2 },
  { kind: "LOSERS_FINAL" as MatchKind, label: "Losers final", row: "b", col: 3 },
  { kind: "GRAND_FINAL" as MatchKind, label: "Grand final", row: "a", col: 4 },
];

/**
 * Returns `null` until Phase 2 starts (still in playpens, or the N=3
 * round-robin path that never reaches it). Matches not yet created in the
 * DB (their feeders haven't resolved) render as `NOT_YET_PLAYED` with
 * both participant slots unknown (`name: null` → "????"), so all six
 * boxes are always visible, not just what exists so far.
 */
export function buildPhase2Bracket(matches: Phase2BracketMatchInput[]): Phase2BracketData | null {
  const byKind = new Map(matches.map((m) => [m.kind as string, m]));
  if (!byKind.has("QF1") && !byKind.has("QF2")) return null;

  const boxes: Phase2Box[] = STAGES.map((stage) => {
    const match = byKind.get(stage.kind);
    // No NEXT_UP distinction here (unlike playpen pens) — a Phase 2
    // match is created directly once its feeders resolve, so there's
    // rarely more than one genuinely PENDING Phase 2 match queued up
    // behind a busy station at once.
    const status: Phase2BoxStatus = !match
      ? "NOT_YET_PLAYED"
      : match.status === "CONFIRMED"
        ? "FINISHED"
        : match.status === "PENDING"
          ? "NOT_YET_PLAYED"
          : match.status === "READY"
            ? "READY"
            : "PLAYING"; // IN_PROGRESS | REPORTED

    const slots: Phase2BoxParticipant[] = [0, 1].map((i) => {
      const p = match?.participants[i];
      if (!p) return { babyId: null, name: null, isWinner: false, avatarSrc: null };
      return { babyId: p.babyId, name: p.name, isWinner: p.finishPosition === 1, avatarSrc: p.avatarSrc };
    });

    return {
      kind: stage.kind,
      label: stage.label,
      status,
      row: stage.row,
      col: stage.col,
      participants: [slots[0]!, slots[1]!],
    };
  });

  return { boxes };
}
