// The spectator screen's view-model — everything /live/[slug] needs in
// one shot, plus the same shape served by /api/playtime/[slug]/state for
// polling. Not part of the pure bracket engine (this is presentation
// logic over live data), but centralized here rather than duplicated
// between the initial server render and the poll endpoint.
import { prisma } from "@/lib/prisma";
import { ensureMatchNotExpired, sortMatchesByPriority } from "@/lib/playtime-lifecycle";
import { buildPhase2Bracket, type Phase2BracketData } from "@/lib/bracket-view";
import { MatchKind } from "@/generated/prisma/enums";
import type { Game, MatchStatus, PlaytimeStatus } from "@/generated/prisma/enums";

export interface SpectatorParticipant {
  babyId: string;
  name: string;
  finishPosition: number | null;
  seedInMatch: number | null;
}

export interface SpectatorMatch {
  matchId: string;
  kind: MatchKind;
  round: number;
  status: MatchStatus;
  stationNumber: number | null;
  deadlineAt: string | null;
  disputed: boolean;
  participants: SpectatorParticipant[];
}

export interface SpectatorStarChartRow {
  babyId: string;
  name: string;
  status: "ACTIVE" | "NAPPED" | "CHAMPION";
  finalPlacement: number | null;
  goldStars: number;
}

export interface SpectatorState {
  playtimeName: string;
  game: Game;
  status: PlaytimeStatus;
  stageBanner: string;
  activeMatches: SpectatorMatch[];
  onDeck: SpectatorParticipant[];
  starChart: SpectatorStarChartRow[];
  bestBaby: { babyId: string; name: string } | null;
  openHelpRequestCount: number;
  lastEventId: number;
  /** null until Phase 2 starts (still in playpens, or the N=3 round-robin path that skips it entirely). */
  phase2Bracket: Phase2BracketData | null;
}

const PHASE2_LABELS: Partial<Record<MatchKind, string>> = {
  [MatchKind.QF1]: "QUARTERFINALS",
  [MatchKind.QF2]: "QUARTERFINALS",
  [MatchKind.LOSERS_R1]: "LOSERS ROUND 1",
  [MatchKind.WINNERS_FINAL]: "WINNERS FINAL",
  [MatchKind.LOSERS_FINAL]: "LOSERS FINAL",
  [MatchKind.GRAND_FINAL]: "GRAND FINAL",
};

export async function computeSpectatorState(slug: string): Promise<SpectatorState | null> {
  const playtime = await prisma.playtime.findUnique({ where: { slug } });
  if (!playtime) return null;

  // Lazily settle any expired-but-unconfirmed matches before rendering —
  // the spectator screen polls constantly, so this is exactly the read
  // path that makes the "no worker" auto-confirm design work in practice.
  const unconfirmed = await prisma.match.findMany({
    where: { playtimeId: playtime.id, status: "REPORTED" },
    select: { id: true },
  });
  for (const m of unconfirmed) await ensureMatchNotExpired(m.id);

  const [matches, babies, helpRequestCount, lastEvent] = await Promise.all([
    prisma.match.findMany({
      where: { playtimeId: playtime.id },
      include: { participants: { include: { baby: true } } },
      orderBy: [{ round: "asc" }, { createdAt: "asc" }],
    }),
    prisma.baby.findMany({
      where: { playtimeId: playtime.id },
      orderBy: [{ status: "asc" }, { finalPlacement: "asc" }, { registrationOrder: "asc" }],
    }),
    prisma.helpRequest.count({ where: { playtimeId: playtime.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    prisma.matchEvent.findFirst({
      where: { match: { playtimeId: playtime.id } },
      orderBy: { id: "desc" },
      select: { id: true },
    }),
  ]);

  const toParticipant = (p: { babyId: string; finishPosition: number | null; seedInMatch: number | null; baby: { displayName: string | null } }): SpectatorParticipant => ({
    babyId: p.babyId,
    name: p.baby.displayName ?? "Unnamed baby",
    finishPosition: p.finishPosition,
    seedInMatch: p.seedInMatch,
  });

  const activeMatches = matches
    .filter((m) => m.status === "READY" || m.status === "IN_PROGRESS" || m.status === "REPORTED")
    .map((m) => ({
      matchId: m.id,
      kind: m.kind,
      round: m.round,
      status: m.status,
      stationNumber: m.stationNumber,
      deadlineAt: m.deadlineAt?.toISOString() ?? null,
      disputed: m.disputed,
      participants: m.participants.map(toParticipant),
    }));

  const pending = sortMatchesByPriority(matches.filter((m) => m.status === "PENDING"));
  const onDeck = pending[0]?.participants.map(toParticipant) ?? [];

  const goldStarCounts = new Map<string, number>();
  for (const m of matches) {
    for (const p of m.participants) {
      if (p.finishPosition === 1) goldStarCounts.set(p.babyId, (goldStarCounts.get(p.babyId) ?? 0) + 1);
    }
  }

  const starChart: SpectatorStarChartRow[] = babies.map((b) => ({
    babyId: b.id,
    name: b.displayName ?? "Unnamed baby",
    status: b.status,
    finalPlacement: b.finalPlacement,
    goldStars: goldStarCounts.get(b.id) ?? 0,
  }));

  const champion = babies.find((b) => b.status === "CHAMPION");
  const aliveCount = babies.filter((b) => b.status === "ACTIVE").length;

  const stageBanner = computeStageBanner(playtime.status, matches, aliveCount);

  const phase2Bracket = buildPhase2Bracket(
    matches.map((m) => ({ kind: m.kind, status: m.status, participants: m.participants.map(toParticipant).map((p) => ({ babyId: p.babyId, name: p.name, finishPosition: p.finishPosition })) })),
  );

  return {
    playtimeName: playtime.name,
    game: playtime.game,
    status: playtime.status,
    stageBanner,
    activeMatches,
    onDeck,
    starChart,
    bestBaby: champion ? { babyId: champion.id, name: champion.displayName ?? "Unnamed baby" } : null,
    openHelpRequestCount: helpRequestCount,
    lastEventId: lastEvent?.id ?? 0,
    phase2Bracket,
  };
}

function computeStageBanner(
  status: PlaytimeStatus,
  matches: { kind: MatchKind; round: number; status: MatchStatus; penIndex: number | null; createdAt: Date }[],
  aliveCount: number,
): string {
  if (status === "COMPLETE") return "🌟 BEST BABY CROWNED 🌟";
  if (status !== "IN_PROGRESS") return "Getting ready…";

  const current = sortMatchesByPriority(matches.filter((m) => m.status !== "CONFIRMED"))[0];
  if (!current) return "Between rounds…";

  if (current.kind === MatchKind.ROUND_ROBIN) return "ROUND ROBIN — 3 babies";
  if (current.kind === MatchKind.PLAYPEN) return `PLAYPEN ROUND ${current.round} — ${aliveCount} babies left`;
  return PHASE2_LABELS[current.kind] ?? current.kind;
}
