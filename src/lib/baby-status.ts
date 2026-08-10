// Derives which of the "what's happening to me right now" card states a
// baby is in, from DB state. Not part of the pure bracket engine (this
// is presentation logic over live data, not tournament structure), but
// deliberately centralized here rather than scattered across components
// so the baby page and (later) Telegram push copy can both drive off it.
import { prisma } from "@/lib/prisma";
import { ensureMatchNotExpired, sortMatchesByPriority } from "@/lib/playtime-lifecycle";

export type BabyStatusState =
  | { kind: "DADDY_COMING" }
  | { kind: "CHAMPION" }
  | { kind: "NAPPED"; placement: number | null }
  | { kind: "NOT_STARTED" }
  | { kind: "QUIET_TIME"; etaMinutes: number | null }
  | { kind: "UP_NEXT"; matchId: string }
  | { kind: "PLAYING"; matchId: string }
  | { kind: "WAITING_ON_PLAYMATES"; matchId: string; deadlineAt: Date }
  | { kind: "AWAITING_YOUR_CONFIRMATION"; matchId: string; deadlineAt: Date; reporterName: string | null };

export async function computeBabyStatus(babyId: string, _depth = 0): Promise<BabyStatusState> {
  const baby = await prisma.baby.findUniqueOrThrow({ where: { id: babyId }, include: { playtime: true } });

  // "Daddy is coming" takes priority over everything else — it's the
  // response to a request the baby just made.
  const ackedHelp = await prisma.helpRequest.findFirst({
    where: { babyId, status: "ACKNOWLEDGED" },
    orderBy: { createdAt: "desc" },
  });
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

  await ensureMatchNotExpired(participation.matchId);
  const match = await prisma.match.findUniqueOrThrow({ where: { id: participation.matchId } });

  if (match.status === "CONFIRMED") {
    // Just got lazily auto-confirmed by the check above — re-derive once
    // (the cascade may have crowned/napped this baby, or queued a new
    // match). Guarded against runaway recursion; in practice this never
    // goes past depth 1.
    if (_depth > 2) return { kind: "QUIET_TIME", etaMinutes: null };
    return computeBabyStatus(babyId, _depth + 1);
  }

  if (match.status === "PENDING") {
    return { kind: "QUIET_TIME", etaMinutes: await computeEtaMinutes(baby.playtimeId, match.id) };
  }
  if (match.status === "READY") {
    return { kind: "UP_NEXT", matchId: match.id };
  }
  if (match.status === "IN_PROGRESS") {
    return { kind: "PLAYING", matchId: match.id };
  }

  // REPORTED
  if (match.reportedById === babyId) {
    return { kind: "WAITING_ON_PLAYMATES", matchId: match.id, deadlineAt: match.deadlineAt! };
  }
  const reporter = match.reportedById ? await prisma.baby.findUnique({ where: { id: match.reportedById } }) : null;
  return {
    kind: "AWAITING_YOUR_CONFIRMATION",
    matchId: match.id,
    deadlineAt: match.deadlineAt!,
    reporterName: reporter?.displayName ?? null,
  };
}

/** "matches queued ahead x rolling average duration for this game" — same priority order the scheduler uses. */
async function computeEtaMinutes(playtimeId: string, matchId: string): Promise<number> {
  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
  const avgSec = playtime.rollingAvgMatchDurationSec ?? playtime.defaultMatchDurationSec;

  const pending = await prisma.match.findMany({ where: { playtimeId, status: "PENDING" } });
  const sorted = sortMatchesByPriority(pending);
  const myIndex = sorted.findIndex((m) => m.id === matchId);
  const matchesAhead = Math.max(0, myIndex);

  const etaSeconds = Math.ceil((matchesAhead + 1) / playtime.stationCount) * avgSec;
  return Math.max(1, Math.round(etaSeconds / 60));
}
