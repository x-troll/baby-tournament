// Merges playpens and the Phase 2 bracket into one left-to-right column
// sequence — every round/stage the tournament has gone through, in
// order, instead of playpens and Phase 2 living in separate sections.
// Connector edges are derived from real shared baby ids between columns
// (not hardcoded pen-to-pen pairings), so a line only ever asserts
// something the data actually shows happened. Exactly one extra column
// is appended past whatever's real — a preview of who's advancing into
// the next round so far — and no further than that: which babies land
// in which *future* pen isn't decided until that round is actually
// seeded and created, so this deliberately doesn't try to predict it.
import type { PlaypenSection, PlaypenViewRound } from "./playpen-view";
import type { Phase2BracketData } from "./bracket-view";
import { toDisplayStatus, type DisplayStatus } from "./match-status";

export interface FlowParticipant {
  babyId: string | null;
  /** null → genuinely unknown yet (render "????"). */
  name: string | null;
  /** True → bolded, and used to compute the connector into the next column. */
  advancing: boolean;
  /** Playpen finish order (1st, 2nd, ...); null for Phase 2 boxes, which just bold the winner instead. */
  finishPosition: number | null;
  avatarSrc: string | null;
}

export interface FlowBox {
  key: string;
  label: string;
  status: DisplayStatus;
  participants: FlowParticipant[];
  /** Losers Round 1 / Losers Final — rendered lower and red-tinted so the losers track visually reads as distinct from the winners track. */
  isLoserTrack?: boolean;
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
  // Same label as col 2 on purpose — Losers Final is a genuinely separate
  // column (it depends on *both* Semifinal results, so it can't share
  // their column without misrepresenting timing), but conceptually it's
  // still part of the semifinal round. The renderer suppresses a header
  // that repeats the previous column's, so this reads as one "Semifinals"
  // heading spanning both columns rather than two stacked identical ones.
  3: "Semifinals",
  4: "Grand final",
};

const LOSER_TRACK_KINDS = new Set(["LOSERS_R1", "LOSERS_FINAL"]);

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
          avatarSrc: p.avatarSrc,
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
          isLoserTrack: LOSER_TRACK_KINDS.has(box.kind),
          // Only the winner counts as "advancing" — the loser still
          // appears (in whatever box the DB says they landed in, e.g.
          // Losers Round 1), just without a drawn connector into it.
          // See PLAN.md.
          participants: box.participants.map((p) => ({
            babyId: p.babyId,
            name: p.name,
            advancing: p.isWinner,
            finishPosition: null,
            avatarSrc: p.avatarSrc,
          })),
        })),
      });
    }
  } else if (playpens) {
    // Phase 2 hasn't started — preview who's advancing into the next
    // round so far, one column, nothing further predicted.
    const lastRound = playpens.rounds.at(-1);
    const preview = lastRound ? buildNextRoundPreview(lastRound) : null;
    if (preview) columns.push(preview);
  }

  const edges = computeEdges(columns);
  edges.push(...computeQuarterfinalLoserEdges(columns));
  return { columns, edges };
}

/**
 * The one loser-track leg drawn despite the generic pass above only
 * following `advancing` (winner) participants: Quarterfinal losers drop
 * into Losers Round 1, and that's worth showing even though they're
 * still rendered unbolded in their Quarterfinal box (losing there, not
 * advancing as a winner). Matched by real shared baby id, same as every
 * other edge, so it only ever draws what the data actually shows.
 */
function computeQuarterfinalLoserEdges(columns: FlowColumn[]): FlowEdge[] {
  const losersR1 = columns.flatMap((c) => c.boxes).find((b) => b.key === "phase2-LOSERS_R1");
  if (!losersR1) return [];

  const edges: FlowEdge[] = [];
  for (const box of columns.flatMap((c) => c.boxes)) {
    if (!box.key.startsWith("phase2-QF")) continue;
    for (const p of box.participants) {
      if (p.advancing || !p.babyId) continue; // only the loser leg
      if (losersR1.participants.some((tp) => tp.babyId === p.babyId)) {
        edges.push({ from: box.key, to: losersR1.key });
      }
    }
  }
  return edges;
}

/**
 * Exactly one column previewing whoever's already known to be advancing
 * out of the last real round — not a guess at the *next* round's actual
 * pen layout (who ends up grouped with whom isn't decided until that
 * round is seeded and created). The only thing this relies on is the
 * one true invariant that holds regardless of pen size: every pen
 * advances exactly 2 (bracket-engine/pens.ts), so the total headcount
 * is just `pens.length * 2` — no engine call needed. As pens finish,
 * their winners fill in real names here; anything not yet decided shows
 * as "????". Nothing after a round-robin (N=3 start) — that decides the
 * whole tournament directly.
 */
function buildNextRoundPreview(lastRound: PlaypenViewRound): FlowColumn | null {
  if (lastRound.isRoundRobin) return null;

  const knownWinners = lastRound.pens
    .flatMap((pen) => pen.participants)
    .filter((p) => p.finishPosition != null && p.finishPosition <= 2)
    .map((p) => ({ babyId: p.babyId, name: p.name, avatarSrc: p.avatarSrc }));
  if (knownWinners.length === 0) return null; // nothing decided yet — nothing to preview

  const totalAdvancing = lastRound.pens.length * 2;
  const slots = [
    ...knownWinners,
    ...Array.from({ length: Math.max(0, totalAdvancing - knownWinners.length) }, () => ({
      babyId: null,
      name: null,
      avatarSrc: null,
    })),
  ];

  return {
    id: "next-round-preview",
    label: "Up next",
    boxes: [
      {
        key: "next-round-preview-box",
        label: "Next round",
        status: "NOT_YET_PLAYED",
        participants: slots.map((s) => ({ ...s, advancing: false, finishPosition: null })),
      },
    ],
  };
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
