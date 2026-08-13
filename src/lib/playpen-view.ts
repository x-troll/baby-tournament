// Groups playpen (and, at N=3, round-robin) matches by round for the
// spectator screen — a "who's with who" view distinct from the Phase 2
// bracket (bracket-view.ts), since a 3-4 baby free-for-all pen has no
// meaningful 1v1 "bracket" shape to render as one. Pure data transform,
// no React — computed once in computeSpectatorState and shared by both
// the initial server render and the poll endpoint.
import type { MatchKind, MatchStatus } from "@/generated/prisma/enums";
import type { Terminology } from "./terminology";

export interface PlaypenViewParticipant {
  babyId: string;
  name: string;
  finishPosition: number | null;
  seedInMatch: number | null;
  avatarSrc: string | null;
}

export interface PlaypenViewMatchInput {
  id: string;
  kind: MatchKind;
  round: number;
  penIndex: number | null;
  status: MatchStatus;
  participants: PlaypenViewParticipant[];
}

export interface PlaypenViewPen {
  matchId: string;
  label: string;
  status: MatchStatus;
  /** True for the single PENDING pen (in the latest round — earlier rounds are always fully resolved) that's first in line by penIndex, i.e. next to get a station. Always false once `status` isn't PENDING. */
  isNextUp: boolean;
  participants: PlaypenViewParticipant[];
}

export interface PlaypenViewRound {
  round: number;
  isRoundRobin: boolean;
  label: string;
  pens: PlaypenViewPen[];
}

export interface PlaypenSection {
  heatLabel: string;
  heatLabelPlural: string;
  rounds: PlaypenViewRound[];
}

const GROUP_STAGE_KINDS = new Set<MatchKind>(["PLAYPEN", "ROUND_ROBIN"] as MatchKind[]);

/**
 * Returns `null` once no group-stage matches exist yet (before start, or
 * once every round has resolved and left no trace to show — in practice
 * always non-null after `startPlaytime`). Takes the whole `Terminology`
 * object (rather than calling `getTerminology()` itself) to stay a pure
 * data transform — same style as its existing `heatLabel`/`heatLabelPlural`
 * params before this, just extended to cover the round/match labels too.
 */
export function buildPlaypenSection(matches: PlaypenViewMatchInput[], t: Terminology): PlaypenSection | null {
  const heatMatches = matches.filter((m) => GROUP_STAGE_KINDS.has(m.kind));
  if (heatMatches.length === 0) return null;

  const heatLabelTitled = t.groupStageHeat.charAt(0).toUpperCase() + t.groupStageHeat.slice(1);
  const rounds = [...new Set(heatMatches.map((m) => m.round))].sort((a, b) => a - b);
  const lastRound = rounds.at(-1);

  return {
    heatLabel: t.groupStageHeat,
    heatLabelPlural: t.groupStageHeatPlural,
    rounds: rounds.map((round) => {
      const inRound = heatMatches.filter((m) => m.round === round);
      const isRoundRobin = inRound.some((m) => m.kind === "ROUND_ROBIN");
      const sorted = isRoundRobin ? inRound : [...inRound].sort((a, b) => (a.penIndex ?? 0) - (b.penIndex ?? 0));

      // Only the latest round can still have PENDING pens — every
      // earlier round is always fully resolved by construction. The
      // first PENDING one here, in pen order, is next in line for a
      // free station.
      const nextUpMatchId = round === lastRound ? (sorted.find((m) => m.status === "PENDING")?.id ?? null) : null;

      return {
        round,
        isRoundRobin,
        label: isRoundRobin ? t.roundRobinRoundLabel : t.roundLabel(round),
        pens: sorted.map((m, i) => ({
          matchId: m.id,
          label: isRoundRobin ? t.roundRobinMatchLabel(i + 1) : `${heatLabelTitled} ${(m.penIndex ?? 0) + 1}`,
          status: m.status,
          isNextUp: m.id === nextUpMatchId,
          participants: m.participants,
        })),
      };
    }),
  };
}
