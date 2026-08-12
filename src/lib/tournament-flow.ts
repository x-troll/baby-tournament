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
        status: toDisplayStatus(pen.status, pen.isNextUp),
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
  edges.push(...computeWinnersFinalLoserEdge(columns));
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
 * The other loser-track leg the generic pass above misses: Winners
 * Final's loser drops into Losers Final (alongside the winner-edge
 * Losers Final already gets from Losers Round 1 via the generic pass),
 * same pattern as `computeQuarterfinalLoserEdges` above.
 */
function computeWinnersFinalLoserEdge(columns: FlowColumn[]): FlowEdge[] {
  const winnersFinal = columns.flatMap((c) => c.boxes).find((b) => b.key === "phase2-WINNERS_FINAL");
  const losersFinal = columns.flatMap((c) => c.boxes).find((b) => b.key === "phase2-LOSERS_FINAL");
  if (!winnersFinal || !losersFinal) return [];

  const edges: FlowEdge[] = [];
  for (const p of winnersFinal.participants) {
    if (p.advancing || !p.babyId) continue; // only the loser leg
    if (losersFinal.participants.some((tp) => tp.babyId === p.babyId)) {
      edges.push({ from: winnersFinal.key, to: losersFinal.key });
    }
  }
  return edges;
}

/** A pen always advances exactly 2 (bracket-engine/pens.ts) — the one invariant this preview leans on. */
const PREVIEW_WINNERS_PER_PEN = 2;
/** Mirrors the real next round's own cap (bracket-engine/pens.ts's 4-then-3 split maximizes 4-baby pens) — keeps a preview box from turning into an ever-growing wall of "????". */
const MAX_PREVIEW_BOX_SIZE = 4;

/**
 * Previews whoever's already known to be advancing out of the last real
 * round — not a guess at the *next* round's actual pen layout (who ends
 * up grouped with whom isn't decided until that round is seeded and
 * created). As pens finish, their winners fill in real names here;
 * anything not yet decided shows as "????". Nothing after a round-robin
 * (N=3 start) — that decides the whole tournament directly.
 *
 * Each pen contributes exactly 2 slots (real winners, sorted by finish
 * position, once it's done — otherwise two placeholders), and those
 * pairs get packed in original pen order into boxes capped at
 * `MAX_PREVIEW_BOX_SIZE`: pen 1 + pen 2 fill the first box, pen 3 + pen
 * 4 the next, and so on (a trailing box of just 2 if the pen count is
 * odd). This is what keeps each box's connector arrows anchored to only
 * the couple of pens that actually feed it — `computeEdges` below
 * matches purely on real shared baby ids, so splitting the target boxes
 * this way is what narrows the arrows; there's no separate arrow rule.
 */
function buildNextRoundPreview(lastRound: PlaypenViewRound): FlowColumn | null {
  if (lastRound.isRoundRobin) return null;

  const penSlots = lastRound.pens.map((pen) => {
    const winners: FlowParticipant[] = pen.participants
      .filter((p) => p.finishPosition != null && p.finishPosition <= 2)
      .sort((a, b) => a.finishPosition! - b.finishPosition!)
      .map((p) => ({ babyId: p.babyId, name: p.name, advancing: false, finishPosition: null, avatarSrc: p.avatarSrc }));
    while (winners.length < PREVIEW_WINNERS_PER_PEN) {
      winners.push({ babyId: null, name: null, advancing: false, finishPosition: null, avatarSrc: null });
    }
    return winners;
  });

  if (!penSlots.some((pair) => pair.some((s) => s.babyId))) return null; // nothing decided yet — nothing to preview

  const boxSlots: FlowParticipant[][] = [];
  for (const pair of penSlots) {
    const current = boxSlots.at(-1);
    if (current && current.length < MAX_PREVIEW_BOX_SIZE) {
      current.push(...pair);
    } else {
      boxSlots.push([...pair]);
    }
  }

  return {
    id: "next-round-preview",
    label: "Up next",
    boxes: boxSlots.map((participants, i) => ({
      key: `next-round-preview-box-${i}`,
      label: boxSlots.length > 1 ? `Next round ${i + 1}` : "Next round",
      status: "NOT_YET_PLAYED",
      participants,
    })),
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
