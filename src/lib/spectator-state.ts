// The spectator screen's view-model — everything /live/[slug] needs in
// one shot, plus the same shape served by /api/playtime/[slug]/state for
// polling. Not part of the pure bracket engine (this is presentation
// logic over live data), but centralized here rather than duplicated
// between the initial server render and the poll endpoint.
import { prisma } from "@/lib/prisma";
import { sortMatchesByPriority } from "@/lib/playtime-lifecycle";
import { buildPhase2Bracket, type Phase2BracketData } from "@/lib/bracket-view";
import { buildPlaypenSection, type PlaypenSection } from "@/lib/playpen-view";
import { getTerminology } from "@/lib/terminology";
import { resolveSelfTerm } from "@/lib/baby-terminology";
import { parseSlugNumber } from "@/lib/slug-number";
import { resolveAvatarSrc } from "@/lib/avatars";
import { babyJoinDeepLink, websiteJoinLink } from "@/lib/qr";
import { MatchKind } from "@/generated/prisma/enums";
import type { Game, MatchStatus, PlaytimeStatus } from "@/generated/prisma/enums";

export interface SpectatorParticipant {
  babyId: string;
  name: string;
  finishPosition: number | null;
  seedInMatch: number | null;
  avatarSrc: string | null;
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
  bestBaby: { babyId: string; name: string; avatarSrc: string | null } | null;
  openHelpRequestCount: number;
  /** Deployment-wide organizer term (see baby-terminology.ts) — this is an aggregate across every baby, so there's no single baby's /profile preference to read here. */
  adminTerm: string;
  lastEventId: number;
  /** null until Phase 2 starts (still in playpens, or the N=3 round-robin path that skips it entirely). */
  phase2Bracket: Phase2BracketData | null;
  /** null before the playtime starts; every round of playpens/round-robin played so far, grouped. */
  playpens: PlaypenSection | null;
  /** Same join deep link shown in the admin panel's QR — surfaced here so the spectator screen can display its own scan-to-join QR while status is NURSERY_OPEN. Null if TELEGRAM_BOT_USERNAME isn't set. */
  joinLink: string | null;
  /** Website counterpart to joinLink, shown side-by-side with it — see NurseryCheckIn. Null if NEXT_PUBLIC_APP_URL isn't set. */
  websiteJoinLink: string | null;
  /** Who's checked in so far, in join order — shown as a Kahoot-style badge row next to the join QR while status is NURSERY_OPEN. Empty (not populated) once the playtime starts; use starChart for the in-progress roster instead. */
  registeredBabies: SpectatorParticipant[];
}

const PHASE2_LABELS: Partial<Record<MatchKind, string>> = {
  [MatchKind.QF1]: "QUARTERFINALS",
  [MatchKind.QF2]: "QUARTERFINALS",
  [MatchKind.LOSERS_R1]: "LOSERS ROUND 1",
  [MatchKind.WINNERS_FINAL]: "WINNERS FINAL",
  [MatchKind.LOSERS_FINAL]: "LOSERS SEMI-FINAL",
  [MatchKind.GRAND_FINAL]: "GRAND FINAL",
};

export async function computeSpectatorState(slug: string): Promise<SpectatorState | null> {
  const slugNumber = parseSlugNumber(slug);
  if (slugNumber === null) return null;
  const playtime = await prisma.playtime.findUnique({ where: { slugNumber } });
  if (!playtime) return null;

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

  const toParticipant = (p: {
    babyId: string;
    finishPosition: number | null;
    seedInMatch: number | null;
    baby: { displayName: string | null; avatarId: string | null };
  }): SpectatorParticipant => ({
    babyId: p.babyId,
    name: p.baby.displayName ?? "Unnamed baby",
    finishPosition: p.finishPosition,
    seedInMatch: p.seedInMatch,
    avatarSrc: resolveAvatarSrc(p.baby.avatarId),
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

  const stageBanner = computeStageBanner(playtime.status, matches, aliveCount, champion ?? null);

  const phase2Bracket = buildPhase2Bracket(
    matches.map((m) => ({
      kind: m.kind,
      status: m.status,
      participants: m.participants
        .map(toParticipant)
        .map((p) => ({ babyId: p.babyId, name: p.name, finishPosition: p.finishPosition, avatarSrc: p.avatarSrc })),
    })),
  );

  // registrationOrder is exactly join order — `babies` above is already
  // sorted by it (secondary key), so no extra sort needed here.
  const registeredBabies: SpectatorParticipant[] =
    playtime.status === "NURSERY_OPEN"
      ? babies.map((b) => ({
          babyId: b.id,
          name: b.displayName ?? "Unnamed baby",
          finishPosition: null,
          seedInMatch: null,
          avatarSrc: resolveAvatarSrc(b.avatarId),
        }))
      : [];

  const t = getTerminology();
  const playpens = buildPlaypenSection(
    matches.map((m) => ({
      id: m.id,
      kind: m.kind,
      round: m.round,
      penIndex: m.penIndex,
      status: m.status,
      participants: m.participants.map(toParticipant),
    })),
    t.groupStageHeat,
    t.groupStageHeatPlural,
  );

  return {
    playtimeName: playtime.name,
    game: playtime.game,
    status: playtime.status,
    stageBanner,
    activeMatches,
    onDeck,
    starChart,
    bestBaby: champion
      ? { babyId: champion.id, name: champion.displayName ?? "Unnamed baby", avatarSrc: resolveAvatarSrc(champion.avatarId) }
      : null,
    openHelpRequestCount: helpRequestCount,
    adminTerm: t.admin,
    lastEventId: lastEvent?.id ?? 0,
    phase2Bracket,
    playpens,
    joinLink: process.env.TELEGRAM_BOT_USERNAME ? babyJoinDeepLink(playtime.joinToken) : null,
    websiteJoinLink: websiteJoinLink(playtime.joinToken),
    registeredBabies,
  };
}

function computeStageBanner(
  status: PlaytimeStatus,
  matches: { kind: MatchKind; round: number; status: MatchStatus; penIndex: number | null; createdAt: Date }[],
  aliveCount: number,
  champion: { selfRoleLabel: string | null; displayName: string | null } | null,
): string {
  if (status === "COMPLETE") {
    const term = champion ? resolveSelfTerm(champion) : getTerminology().player;
    const name = champion?.displayName ?? "Unnamed baby";
    return `The very best ${term} won, ${name}`;
  }
  if (status !== "IN_PROGRESS") return "Getting ready…";

  const current = sortMatchesByPriority(matches.filter((m) => m.status !== "CONFIRMED"))[0];
  if (!current) return "Between rounds…";

  if (current.kind === MatchKind.ROUND_ROBIN) return "ROUND ROBIN, 3 babies";
  if (current.kind === MatchKind.PLAYPEN) return `PLAYPEN ROUND ${current.round}, ${aliveCount} babies left`;
  return PHASE2_LABELS[current.kind] ?? current.kind;
}
