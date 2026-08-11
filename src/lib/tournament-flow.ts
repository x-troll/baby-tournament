// Merges playpens and the Phase 2 bracket into one left-to-right column
// sequence — every round/stage the tournament has gone through, in
// order, instead of playpens and Phase 2 living in separate sections.
// Connector edges are derived from real shared baby ids between columns
// (not hardcoded pen-to-pen pairings), so a line only ever asserts
// something the data actually shows happened. Rounds that haven't been
// created in the DB yet are forecast structurally (pen count/size, via
// the pure bracket-engine — no real assignments exist yet, so their
// boxes just show "????" and render grayed out).
import type { PlaypenSection } from "./playpen-view";
import type { Phase2BracketData } from "./bracket-view";
import { toDisplayStatus, type DisplayStatus } from "./match-status";
import { computeRoundLayout } from "./bracket-engine";

export interface FlowParticipant {
  babyId: string | null;
  /** null → genuinely unknown yet (render "????"). */
  name: string | null;
  /** True → bolded, and used to compute the connector into the next column. */
  advancing: boolean;
  /** Playpen finish order (1st, 2nd, ...); null for Phase 2 boxes, which just bold the winner instead. */
  finishPosition: number | null;
}

export interface FlowBox {
  key: string;
  label: string;
  status: DisplayStatus;
  participants: FlowParticipant[];
}

export interface FlowColumn {
  id: string;
  label: string;
  boxes: FlowBox[];
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface TournamentFlow {
  columns: FlowColumn[];
  edges: FlowEdge[];
}

const PHASE2_COLUMN_LABELS: Record<number, string> = {
  1: "Quarterfinals",
  2: "Semifinals",
  3: "Losers final",
  4: "Grand final",
};

export function buildTournamentFlow(
  playpens: PlaypenSection | null,
  phase2: Phase2BracketData | null,
): TournamentFlow | null {
  if (!playpens && !phase2) return null;

  const columns: FlowColumn[] = [];

  for (const round of playpens?.rounds ?? []) {
    const advancingThreshold = round.isRoundRobin ? 1 : 2;
    columns.push({
      id: `round-${round.round}`,
      label: round.label,
      boxes: round.pens.map((pen) => ({
        key: `pen-${pen.matchId}`,
        label: pen.label,
        status: toDisplayStatus(pen.status),
        participants: pen.participants.map((p) => ({
          babyId: p.babyId,
          name: p.name,
          advancing: p.finishPosition != null && p.finishPosition <= advancingThreshold,
          finishPosition: p.finishPosition,
        })),
      })),
    });
  }

  if (phase2) {
    const byCol = new Map<number, typeof phase2.boxes>();
    for (const box of phase2.boxes) {
      byCol.set(box.col, [...(byCol.get(box.col) ?? []), box]);
    }
    for (const col of [1, 2, 3, 4] as const) {
      const boxesInCol = byCol.get(col) ?? [];
      if (boxesInCol.length === 0) continue;
      columns.push({
        id: `phase2-col-${col}`,
        label: PHASE2_COLUMN_LABELS[col]!,
        boxes: boxesInCol.map((box) => ({
          key: `phase2-${box.kind}`,
          label: box.label,
          status: box.status,
          // Only the winner counts as "advancing" — the loser still
          // appears (in whatever box the DB says they landed in, e.g.
          // Losers Round 1), just without a drawn connector into it.
          // See PLAN.md.
          participants: box.participants.map((p) => ({
            babyId: p.babyId,
            name: p.name,
            advancing: p.isWinner,
            finishPosition: null,
          })),
        })),
      });
    }
  } else if (playpens) {
    // Phase 2 hasn't started — forecast the remaining playpen rounds
    // structurally (pen count/size only, via the pure bracket-engine;
    // *who* ends up in which pen isn't decided until each round is
    // actually seeded and created) so the diagram shows the whole
    // remaining shape, not just what's been played so far.
    columns.push(...forecastFutureRounds(playpens));
  }

  return { columns, edges: computeEdges(columns) };
}

/**
 * Every pen advances exactly 2 regardless of size (bracket-engine/pens.ts's
 * even-survivor invariant), so the next round's alive count — and
 * therefore its whole pen layout — is knowable the moment the previous
 * round's pens exist, even before a single match in it has been played.
 * Stops once the layout reaches Final Four (Phase 2 takes over from
 * there); does nothing after a round-robin (N=3 start), since that
 * decides the whole tournament directly with no further rounds.
 */
function forecastFutureRounds(playpens: PlaypenSection): FlowColumn[] {
  const lastRound = playpens.rounds.at(-1);
  if (!lastRound || lastRound.isRoundRobin) return [];

  const columns: FlowColumn[] = [];
  let alive = lastRound.pens.length * 2;
  let roundNumber = lastRound.round + 1;

  for (let guard = 0; alive > 4 && guard < 20; guard++) {
    const plan = computeRoundLayout(alive, false);
    if (plan.kind !== "PENS") break; // shouldn't happen mid-tournament — guard rather than throw in a view-model builder

    const penSizes = [...Array(plan.fourPens).fill(4), ...Array(plan.threePens).fill(3)];
    columns.push({
      id: `round-${roundNumber}-forecast`,
      label: `Round ${roundNumber}`,
      boxes: penSizes.map((size, i) => ({
        key: `forecast-r${roundNumber}-p${i}`,
        label: `Playpen ${i + 1}`,
        status: "NOT_YET_PLAYED" as const,
        participants: Array.from({ length: size }, () => ({
          babyId: null,
          name: null,
          advancing: false,
          finishPosition: null,
        })),
      })),
    });

    alive = penSizes.length * 2;
    roundNumber += 1;
  }

  return columns;
}

/**
 * For each box, follow every advancing baby into whichever box contains
 * them next — no assumed pairing, just what the data shows. Searches
 * forward through *later* columns, not just the immediately next one:
 * the Phase 2 winners-bracket track (Winners Final → Grand Final) skips
 * straight over the Losers Final column, since that column only exists
 * for the losers-bracket track. Stops at the first column where the
 * baby turns up, so a track never draws past its actual next box.
 */
function computeEdges(columns: FlowColumn[]): FlowEdge[] {
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < columns.length; i++) {
    for (const box of columns[i]!.boxes) {
      for (const p of box.participants) {
        if (!p.advancing || !p.babyId) continue;
        for (let j = i + 1; j < columns.length; j++) {
          const target = columns[j]!.boxes.find((b) => b.participants.some((tp) => tp.babyId === p.babyId));
          if (!target) continue;
          const key = `${box.key}>${target.key}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ from: box.key, to: target.key });
          }
          break;
        }
      }
    }
  }

  return edges;
}
