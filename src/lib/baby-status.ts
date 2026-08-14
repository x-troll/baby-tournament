// Derives which of the "what's happening to me right now" card states a
// baby is in, from DB state. Not part of the pure bracket engine (this
// is presentation logic over live data, not tournament structure), but
// deliberately centralized here rather than scattered across components
// so the baby page and (later) Telegram push copy can both drive off it.
import { prisma } from "@/lib/prisma";
import { sortMatchesByPriority } from "@/lib/playtime-lifecycle";

export type BabyStatusState =
  | { kind: "DADDY_COMING" }
  | { kind: "CHAMPION" }
  | { kind: "NAPPED"; placement: number | null }
  | { kind: "NOT_STARTED" }
  | { kind: "QUIET_TIME"; etaMinutes: number | null }
  | { kind: "UP_NEXT"; matchId: string }
  | { kind: "PLAYING"; matchId: string };

export async function computeBabyStatus(babyId: string, _depth = 0): Promise<BabyStatusState> {
  // Neither query depends on the other's result — both only need
  // babyId, already known before either runs — so there's no reason to
  // serialize them into two round trips.
  const [baby, ackedHelp] = await Promise.all([
    prisma.baby.findUniqueOrThrow({ where: { id: babyId }, include: { playtime: true } }),
    // "Daddy is coming" takes priority over everything else — it's the
    // response to a request the baby just made.
    prisma.helpRequest.findFirst({
      where: { babyId, status: "ACKNOWLEDGED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (ackedHelp) return { kind: "DADDY_COMING" };

  if (baby.status === "CHAMPION") return { kind: "CHAMPION" };
  if (baby.status === "NAPPED") return { kind: "NAPPED", placement: baby.finalPlacement };
  if (baby.playtime.status !== "IN_PROGRESS") return { kind: "NOT_STARTED" };

  const participation = await prisma.matchParticipant.findFirst({
    where: { babyId, match: { status: { not: "CONFIRMED" } } },
    include: { match: true },
    orderBy: { match: { createdAt: "desc" } },
  });
  if (!participation) return { kind: "QUIET_TIME", etaMinutes: null };

  const match = await prisma.match.findUniqueOrThrow({ where: { id: participation.matchId } });

  if (match.status === "CONFIRMED") {
    // The cascade may have crowned/napped this baby, or queued a new
    // match — re-derive once. Guarded against runaway recursion; in
    // practice this never goes past depth 1.
    if (_depth > 2) return { kind: "QUIET_TIME", etaMinutes: null };
    return computeBabyStatus(babyId, _depth + 1);
  }

  if (match.status === "PENDING") {
    return { kind: "QUIET_TIME", etaMinutes: await computeEtaMinutes(baby.playtimeId, match.id) };
  }
  if (match.status === "READY") {
    return { kind: "UP_NEXT", matchId: match.id };
  }
  // IN_PROGRESS is the only status left once CONFIRMED/PENDING/READY are
  // all handled above — MatchStatus has no separate "reported, awaiting
  // confirmation" state; a baby's own report instantly confirms the
  // match (see confirmMatchResult).
  return { kind: "PLAYING", matchId: match.id };
}

// The buffer added on top of a match's normal expected duration before
// it's considered overdue — see `stationFreeInSec` below.
const OVERTIME_BUFFER_SEC = 5 * 60;

/**
 * Simulates each station freeing up and picking the next match in
 * priority order (same order the scheduler itself uses), rather than the
 * old flat "matches ahead / station count x average duration" estimate —
 * that ignored whichever matches are already under way. A station
 * currently mid-match doesn't free up in a fresh `avgSec` from now; it
 * frees up in whatever's left of (normal expected duration + 5 minute
 * grace) *counted from the actual moment that match's players tapped
 * "We're playing"* (its `STARTED` event), not from whenever it was
 * created or made READY — a match that's run long already eats into that
 * grace window instead of pushing the estimate out further. A READY
 * match (station assigned, nobody's tapped start yet) has no such
 * timestamp to count down from, so it's treated as freeing up in a full
 * `avgSec` from now, same as the old model implicitly assumed for a
 * match "in flight".
 */
async function computeEtaMinutes(playtimeId: string, matchId: string): Promise<number> {
  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
  const avgSec = playtime.defaultMatchDurationSec;

  const [pending, active] = await Promise.all([
    prisma.match.findMany({ where: { playtimeId, status: "PENDING" } }),
    prisma.match.findMany({
      where: { playtimeId, status: { in: ["IN_PROGRESS", "READY"] } },
      include: { events: { where: { type: "STARTED" }, orderBy: { id: "desc" }, take: 1 } },
    }),
  ]);

  const now = Date.now();
  const maxSec = avgSec + OVERTIME_BUFFER_SEC;
  const stationFreeInSec = active.map((m) => {
    const startedAt = m.status === "IN_PROGRESS" ? m.events[0]?.createdAt : null;
    if (!startedAt) return avgSec; // READY, not actually started yet — no real elapsed time to subtract
    const elapsedSec = (now - startedAt.getTime()) / 1000;
    return Math.max(0, maxSec - elapsedSec);
  });
  while (stationFreeInSec.length < playtime.stationCount) stationFreeInSec.push(0);

  const sorted = sortMatchesByPriority(pending);
  const myIndex = sorted.findIndex((m) => m.id === matchId);
  if (myIndex === -1) return Math.max(1, Math.round(Math.min(...stationFreeInSec) / 60));

  let myEtaSec = 0;
  for (let i = 0; i <= myIndex; i++) {
    let soonestStation = 0;
    for (let s = 1; s < stationFreeInSec.length; s++) {
      if (stationFreeInSec[s]! < stationFreeInSec[soonestStation]!) soonestStation = s;
    }
    const freeInSec = stationFreeInSec[soonestStation]!;
    if (i === myIndex) myEtaSec = freeInSec;
    stationFreeInSec[soonestStation] = freeInSec + avgSec;
  }
  return Math.max(1, Math.round(myEtaSec / 60));
}
