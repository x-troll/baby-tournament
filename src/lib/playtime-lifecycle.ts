// The DB-aware orchestration layer: this is where the pure bracket
// engine (src/lib/bracket-engine, zero DB imports) gets wired to Prisma.
// Every exported function here runs inside a single transaction so a
// match confirmation and everything it cascades into (round completion,
// elimination processing, Phase 2 creation, tournament completion) commit
// or fail together.
// No `import "server-only"` — also used directly by standalone scripts
// (the Phase 8 rehearsal seed plays a full tournament through this same
// module), which run outside Next's build pipeline. See src/lib/auth.ts.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { MatchKind, MatchStatus } from "@/generated/prisma/enums";
import {
  notifyBabyCrowned,
  notifyBabyNapped,
  notifyBabyResultConfirmed,
  notifyBabyUpNext,
  notifyBabyUpSoon,
  notifyMatchStarted,
} from "@/lib/telegram/notify";
import type { Phase2MatchId, Phase2Result, Phase2Seeds, PenResult, EliminatedRoundEntry } from "@/lib/bracket-engine";
import {
  assignBabiesToPens,
  assignEliminatedPlacements,
  computeByeRoundAssignment,
  computePhase2Placements,
  computeRoundLayout,
  computeRoundRobinStandings,
  computeSeedingScore,
  generateRoundRobinFixtures,
  getPlayablePhase2Matches,
  isPhase2Complete,
} from "@/lib/bracket-engine";

type Tx = Prisma.TransactionClient;

const PHASE2_KINDS: MatchKind[] = [
  MatchKind.QF1,
  MatchKind.QF2,
  MatchKind.LOSERS_R1,
  MatchKind.WINNERS_FINAL,
  MatchKind.LOSERS_FINAL,
  MatchKind.GRAND_FINAL,
];

// Fixed scheduling priority when more than one station is free (default
// stationCount is 1, so this rarely matters in practice — see PLAN.md).
// In practice Phase 2 and playpen matches are never pending
// simultaneously (Phase 2 only gets created once every playpen match is
// confirmed), so this mostly just orders within one round/stage.
const KIND_PRIORITY: Record<MatchKind, number> = {
  [MatchKind.GRAND_FINAL]: 0,
  [MatchKind.LOSERS_FINAL]: 1,
  [MatchKind.WINNERS_FINAL]: 1,
  [MatchKind.LOSERS_R1]: 1,
  [MatchKind.QF1]: 2,
  [MatchKind.QF2]: 2,
  [MatchKind.ROUND_ROBIN]: 3,
  [MatchKind.PLAYPEN]: 3,
};

/**
 * Telegram pushes fire inline when state changes (no worker process),
 * but never *inside* a transaction — a push failing or being slow must
 * never roll back a confirmed result, and the DB write must never wait
 * on a network call. So mutations collect "what happened" into one of
 * these as they go, and the top-level exported function dispatches
 * pushes from it only after the transaction has committed.
 */
interface NotificationCollector {
  readyMatchIds: Set<string>;
  nappedBabies: { babyId: string; placement: number }[];
  crownedBabyId: string | null;
  /** Participants of a match that just became CONFIRMED — get "result confirmed" unless they're also napped/crowned above. */
  confirmedParticipantBabyIds: Set<string>;
  /** The still-PENDING match that's now the immediate next-in-line, if this pass is the first to notice — a one-time "you're up soon" heads-up ahead of the real "you're up" push. See upSoonNotifiedAt. */
  upSoonMatchId: string | null;
}

function newCollector(): NotificationCollector {
  return {
    readyMatchIds: new Set(),
    nappedBabies: [],
    crownedBabyId: null,
    confirmedParticipantBabyIds: new Set(),
    upSoonMatchId: null,
  };
}

async function dispatchCollectedNotifications(collector: NotificationCollector): Promise<void> {
  for (const matchId of collector.readyMatchIds) {
    const participants = await prisma.matchParticipant.findMany({ where: { matchId } });
    for (const p of participants) {
      await notifyBabyUpNext(p.babyId, matchId);
    }
  }

  if (collector.upSoonMatchId) {
    const participants = await prisma.matchParticipant.findMany({ where: { matchId: collector.upSoonMatchId } });
    for (const p of participants) {
      await notifyBabyUpSoon(p.babyId);
    }
  }

  const nappedOrCrowned = new Set(collector.nappedBabies.map((n) => n.babyId));
  if (collector.crownedBabyId) nappedOrCrowned.add(collector.crownedBabyId);
  for (const babyId of collector.confirmedParticipantBabyIds) {
    if (!nappedOrCrowned.has(babyId)) await notifyBabyResultConfirmed(babyId);
  }

  for (const { babyId, placement } of collector.nappedBabies) {
    await notifyBabyNapped(babyId, placement);
  }
  if (collector.crownedBabyId) {
    await notifyBabyCrowned(collector.crownedBabyId);
  }
}

// ── Public entry points ──────────────────────────────────────────────

/** NURSERY_OPEN -> IN_PROGRESS, kicks off round 1 (or straight to Phase 2 if exactly 4 registered). */
export async function startPlaytime(playtimeId: string): Promise<void> {
  const collector = newCollector();
  await prisma.$transaction(async (tx) => {
    const playtime = await tx.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
    if (playtime.status !== "NURSERY_OPEN") {
      throw new Error(`Cannot start a playtime from status ${playtime.status} (must be NURSERY_OPEN).`);
    }

    const aliveCount = await tx.baby.count({ where: { playtimeId, status: "ACTIVE" } });
    if (aliveCount < 3) {
      throw new Error(`Need at least 3 babies to start a playtime, only ${aliveCount} checked in.`);
    }

    await tx.playtime.update({ where: { id: playtimeId }, data: { status: "IN_PROGRESS" } });

    if (aliveCount === 4) {
      await startPhase2(tx, playtimeId);
    } else {
      await createNextPlaypenRound(tx, playtimeId, /* isTournamentStart */ true);
    }
    await scheduleReadyMatches(tx, playtimeId, collector);
  });
  await dispatchCollectedNotifications(collector);
}

export type ConfirmActor =
  | { type: "ADMIN"; adminId: string }
  | { type: "BABY"; babyId: string }
  | { type: "SYSTEM" };

export interface ConfirmMatchResultInput {
  matchId: string;
  /** Ordered baby ids, best (winner / 1st place) first. Must match this match's participant set exactly. */
  orderedBabyIds: string[];
  actor: ConfirmActor;
}

/**
 * The one code path for both playpen results (3-4 finishers) and Phase 2
 * 1v1 results (2 finishers) — same function, same validation, same
 * cascade. Always instant CONFIRMED, no waiting window: used by admin
 * override, by the auto-no-show/forfeit resolution paths, and by a
 * baby's own self-report (`actor: { type: "BABY", ... }` — see
 * `babyReportResultAction`). A baby's report finalizes the match
 * immediately; there's no separate confirm-from-the-other-participants
 * step. A wrong result gets corrected afterward via the admin panel's
 * "Undo last result", same as any admin correction.
 */
export async function confirmMatchResult(input: ConfirmMatchResultInput): Promise<void> {
  const collector = newCollector();
  await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: input.matchId },
      include: { participants: true },
    });

    if (match.status === "CONFIRMED") {
      throw new Error("This match has already been confirmed.");
    }

    setOrderedFinishPositions(match, input.orderedBabyIds);
    for (let i = 0; i < input.orderedBabyIds.length; i++) {
      await tx.matchParticipant.updateMany({
        where: { matchId: match.id, babyId: input.orderedBabyIds[i] },
        data: { finishPosition: i + 1 },
      });
    }

    await tx.match.update({
      where: { id: match.id },
      data: {
        status: "CONFIRMED",
        disputed: false, // an admin override always resolves any outstanding dispute
        reportedById: input.actor.type === "BABY" ? input.actor.babyId : match.reportedById,
        deadlineAt: null,
      },
    });

    await tx.matchEvent.create({
      data: {
        matchId: match.id,
        type: input.actor.type === "ADMIN" ? "OVERRIDDEN" : "CONFIRMED",
        payload: { orderedBabyIds: input.orderedBabyIds },
        actorType: input.actor.type,
        actorAdminId: input.actor.type === "ADMIN" ? input.actor.adminId : null,
        actorBabyId: input.actor.type === "BABY" ? input.actor.babyId : null,
      },
    });

    for (const babyId of input.orderedBabyIds) collector.confirmedParticipantBabyIds.add(babyId);
    await runPostConfirmationCascade(tx, match.playtimeId, match.kind, match.round, match.id, collector);
  });
  await dispatchCollectedNotifications(collector);
}

/**
 * READY -> IN_PROGRESS: any participant heading to the console taps this.
 * Distinguishes "up next, go find your station" from "playing now, report
 * when you're done" on the baby status card — no cascade, just a status
 * bump + event.
 *
 * Idempotent/monotonic by design: this is reachable from two independent
 * places now (the web "We're playing" button and the Telegram "we're
 * playing" callback button), plus either could get double-tapped, so a
 * second call landing after the match is already IN_PROGRESS is a
 * silent no-op rather than an error — it never moves status backward,
 * only ever forward from READY.
 */
export async function markMatchInProgress(matchId: string, babyId: string): Promise<void> {
  const justStarted = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { participants: true } });
    if (!match.participants.some((p) => p.babyId === babyId)) {
      throw new Error("Only a participant in this match can start it.");
    }
    if (match.status === "IN_PROGRESS") return false; // already started — no-op
    if (match.status !== "READY") {
      throw new Error("Only a READY match can be marked in progress.");
    }
    await tx.match.update({ where: { id: matchId }, data: { status: "IN_PROGRESS" } });
    await tx.matchEvent.create({
      data: { matchId, type: "STARTED", payload: {}, actorType: "BABY", actorBabyId: babyId },
    });
    return true;
  });
  // Only on the real READY -> IN_PROGRESS transition — a double-tap (see
  // the idempotency note above) shouldn't re-send the "good job, go
  // play" push a second time.
  if (justStarted) await notifyMatchStarted(matchId, babyId);
}

function setOrderedFinishPositions(
  match: { participants: { babyId: string }[] },
  orderedBabyIds: string[],
): void {
  if (match.participants.length !== orderedBabyIds.length) {
    throw new Error(`Expected ${match.participants.length} finishers for this match, got ${orderedBabyIds.length}.`);
  }
  const participantIds = new Set(match.participants.map((p) => p.babyId));
  for (const babyId of orderedBabyIds) {
    if (!participantIds.has(babyId)) {
      throw new Error(`Baby ${babyId} is not a participant in this match.`);
    }
  }
  if (new Set(orderedBabyIds).size !== orderedBabyIds.length) {
    throw new Error("Duplicate baby in the reported finishing order.");
  }
}

async function runPostConfirmationCascade(
  tx: Tx,
  playtimeId: string,
  kind: MatchKind,
  round: number,
  confirmedMatchId: string,
  collector: NotificationCollector,
): Promise<void> {
  if (kind === MatchKind.PLAYPEN) {
    const roundMatches = await tx.match.findMany({ where: { playtimeId, kind: MatchKind.PLAYPEN, round } });
    if (roundMatches.every((m) => m.status === "CONFIRMED" || m.id === confirmedMatchId)) {
      await processCompletedPlaypenRound(tx, playtimeId, round, collector);
    }
  } else if (kind === MatchKind.ROUND_ROBIN) {
    const rrMatches = await tx.match.findMany({ where: { playtimeId, kind: MatchKind.ROUND_ROBIN } });
    if (rrMatches.every((m) => m.status === "CONFIRMED" || m.id === confirmedMatchId)) {
      await processCompletedRoundRobin(tx, playtimeId, collector);
    }
  } else {
    await processCompletedPhase2Match(tx, playtimeId, collector);
  }

  await scheduleReadyMatches(tx, playtimeId, collector);
}

/**
 * Scoped, safe undo: only the single most-recently-confirmed result in
 * the whole playtime can be undone, and only if it hasn't already
 * cascaded into creating further matches (next round / Phase 2 /
 * completion). Full cascading undo — reverting a confirmation *and*
 * everything it triggered — is real future work, deliberately not
 * attempted here; see PLAN.md.
 */
export async function undoLastMatchResult(matchId: string, adminId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { playtime: true } });
    if (match.status !== "CONFIRMED") {
      throw new Error("Only a confirmed match can be undone.");
    }
    // Completion (ROUND_ROBIN or GRAND_FINAL confirming) updates Baby and
    // Playtime rows without necessarily creating a new Match row, so the
    // laterMatchExists check below wouldn't catch it on its own.
    if (match.playtime.status === "COMPLETE") {
      throw new Error("Can't undo, this result already completed the playtime.");
    }

    const mostRecentEvent = await tx.matchEvent.findFirst({
      where: {
        type: { in: ["CONFIRMED", "OVERRIDDEN", "AUTO_CONFIRMED"] },
        match: { playtimeId: match.playtimeId },
      },
      orderBy: { id: "desc" },
    });
    if (!mostRecentEvent || mostRecentEvent.matchId !== matchId) {
      throw new Error("Only the most recently confirmed result in this playtime can be undone, undo that one first.");
    }

    // Catches "this confirmation spawned new matches" (next playpen
    // round, or Phase 2 progression such as QF1 confirming after QF2 was
    // already done, which creates LOSERS_R1 + WINNERS_FINAL).
    const laterMatchExists = await tx.match.findFirst({
      where: { playtimeId: match.playtimeId, createdAt: { gt: match.updatedAt } },
    });
    if (laterMatchExists) {
      throw new Error(
        "Can't undo, this result already advanced the tournament (started the next round or Phase 2).",
      );
    }

    // Catches "this confirmation finalized a baby's status/placement
    // directly" even when it didn't spawn a new match — e.g. LOSERS_R1
    // confirming before WINNERS_FINAL still naps the 4th-place baby
    // immediately (see processCompletedPhase2Match), with nothing new
    // created until WINNERS_FINAL also resolves.
    const participants = await tx.matchParticipant.findMany({ where: { matchId }, include: { baby: true } });
    if (participants.some((p) => p.baby.status !== "ACTIVE")) {
      throw new Error(
        "Can't undo, this result already changed a baby's status (napped/crowned). Full cascading undo isn't supported yet.",
      );
    }

    await tx.matchParticipant.updateMany({ where: { matchId }, data: { finishPosition: null } });
    await tx.match.update({ where: { id: matchId }, data: { status: "IN_PROGRESS", reportedById: null } });
    await tx.matchEvent.create({
      data: { matchId, type: "UNDONE", payload: {}, actorType: "ADMIN", actorAdminId: adminId },
    });
  });
}

// ── Round creation ────────────────────────────────────────────────────

async function createNextPlaypenRound(tx: Tx, playtimeId: string, isTournamentStart: boolean): Promise<void> {
  const rankedBabyIds = await rankActiveBabyIds(tx, playtimeId, isTournamentStart);
  const n = rankedBabyIds.length;
  const plan = computeRoundLayout(n, isTournamentStart);

  if (plan.kind === "FINAL_FOUR") {
    throw new Error("createNextPlaypenRound: N=4 should be routed to startPhase2 by the caller, not here.");
  }

  if (plan.kind === "ROUND_ROBIN") {
    const [a, b, c] = rankedBabyIds as [string, string, string];
    for (const [babyA, babyB] of generateRoundRobinFixtures([a, b, c])) {
      await createSimpleMatch(tx, playtimeId, MatchKind.ROUND_ROBIN, 1, null, [babyA, babyB]);
    }
    return;
  }

  const nextRound = await nextPlaypenRoundNumber(tx, playtimeId);

  if (plan.kind === "BYE_ROUND") {
    const { penBabyIds } = computeByeRoundAssignment(rankedBabyIds);
    // The 2 bye babies just stay ACTIVE with no match this round.
    await createSimpleMatch(tx, playtimeId, MatchKind.PLAYPEN, nextRound, 0, penBabyIds);
    return;
  }

  // plan.kind === "PENS"
  const slotSizes = [...Array(plan.fourPens).fill(4), ...Array(plan.threePens).fill(3)];
  const pens = assignBabiesToPens(rankedBabyIds, slotSizes);
  for (const pen of pens) {
    await createSimpleMatch(tx, playtimeId, MatchKind.PLAYPEN, nextRound, pen.penIndex, pen.babyIds);
  }
}

async function startPhase2(tx: Tx, playtimeId: string): Promise<void> {
  const activeBabies = await tx.baby.findMany({
    where: { playtimeId, status: "ACTIVE" },
    orderBy: { registrationOrder: "asc" },
  });
  if (activeBabies.length !== 4) {
    throw new Error(`startPhase2: expected exactly 4 active babies, got ${activeBabies.length}.`);
  }

  const penResults = await getConfirmedPlaypenResults(tx, playtimeId);
  // "Seed by registration order if there's no history yet" applies here
  // too, not just pen assignment: a playtime that starts with exactly 4
  // babies skips playpens entirely, so computeSeedingScore would see zero
  // pen results, every baby tied at 0, and fall through to its random
  // tiebreak — which isn't "no history yet, use registration order," it's
  // "no history yet, flip a coin." Bypass the engine's scoring path
  // entirely in that specific case rather than let an empty-history
  // input silently reach the random tiebreak.
  const seedByBabyId = new Map<string, number>();
  if (penResults.length === 0) {
    activeBabies.forEach((b, i) => seedByBabyId.set(b.id, i + 1));
  } else {
    const seeds = computeSeedingScore(
      activeBabies.map((b) => b.id),
      penResults,
    );
    for (const s of seeds) seedByBabyId.set(s.babyId, s.seed);
  }
  for (const [babyId, seed] of seedByBabyId) {
    await tx.baby.update({ where: { id: babyId }, data: { seed } });
  }

  const bySeed = new Map([...seedByBabyId.entries()].map(([babyId, seed]) => [seed, babyId]));
  const seed1 = bySeed.get(1)!;
  const seed2 = bySeed.get(2)!;
  const seed3 = bySeed.get(3)!;
  const seed4 = bySeed.get(4)!;

  await createSimpleMatch(tx, playtimeId, MatchKind.QF1, 1, null, [seed1, seed4], [1, 4]);
  await createSimpleMatch(tx, playtimeId, MatchKind.QF2, 1, null, [seed2, seed3], [2, 3]);
}

// ── Round/match completion cascades ──────────────────────────────────

async function processCompletedPlaypenRound(
  tx: Tx,
  playtimeId: string,
  round: number,
  collector: NotificationCollector,
): Promise<void> {
  const matches = await tx.match.findMany({
    where: { playtimeId, kind: MatchKind.PLAYPEN, round },
    include: { participants: { include: { baby: true } } },
  });

  const aliveCountBefore = await tx.baby.count({ where: { playtimeId, status: "ACTIVE" } });
  const eliminated: EliminatedRoundEntry[] = [];

  for (const match of matches) {
    const sorted = [...match.participants].sort(
      (a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99),
    );
    sorted.forEach((p, idx) => {
      const position = idx + 1;
      if (position > 2) {
        eliminated.push({
          babyId: p.babyId,
          penSize: sorted.length,
          penPosition: position,
          tiebreakOrder: p.baby.registrationOrder,
        });
      }
    });
  }

  const placements = assignEliminatedPlacements(eliminated, aliveCountBefore);
  for (const [babyId, place] of placements) {
    await tx.baby.update({ where: { id: babyId }, data: { status: "NAPPED", finalPlacement: place } });
    collector.nappedBabies.push({ babyId, placement: place });
  }
  // Babies who advanced (top 2 of their pen) and bye babies both simply
  // stay ACTIVE — nothing to update for them.

  const newAliveCount = await tx.baby.count({ where: { playtimeId, status: "ACTIVE" } });
  if (newAliveCount === 4) {
    await startPhase2(tx, playtimeId);
  } else if (newAliveCount < 4) {
    throw new Error(
      `processCompletedPlaypenRound: alive count dropped to ${newAliveCount}, below the Phase 2 threshold, even-survivor invariant violated.`,
    );
  } else {
    await createNextPlaypenRound(tx, playtimeId, false);
  }
}

async function processCompletedRoundRobin(tx: Tx, playtimeId: string, collector: NotificationCollector): Promise<void> {
  const matches = await tx.match.findMany({
    where: { playtimeId, kind: MatchKind.ROUND_ROBIN },
    include: { participants: true },
  });
  const babyIds = [...new Set(matches.flatMap((m) => m.participants.map((p) => p.babyId)))] as [
    string,
    string,
    string,
  ];
  const results = matches.map((m) => {
    const winner = m.participants.find((p) => p.finishPosition === 1);
    const loser = m.participants.find((p) => p.finishPosition === 2);
    if (!winner || !loser) throw new Error(`Round-robin match ${m.id} is missing a recorded result.`);
    return { winner: winner.babyId, loser: loser.babyId };
  });

  const standings = computeRoundRobinStandings(babyIds, results);
  for (const p of standings) {
    await tx.baby.update({
      where: { id: p.babyId },
      data: { finalPlacement: p.place, status: p.place === 1 ? "CHAMPION" : "NAPPED" },
    });
    if (p.place === 1) collector.crownedBabyId = p.babyId;
    else collector.nappedBabies.push({ babyId: p.babyId, placement: p.place });
  }
  await tx.playtime.update({ where: { id: playtimeId }, data: { status: "COMPLETE" } });
}

async function processCompletedPhase2Match(tx: Tx, playtimeId: string, collector: NotificationCollector): Promise<void> {
  const matches = await tx.match.findMany({
    where: { playtimeId, kind: { in: PHASE2_KINDS }, status: "CONFIRMED" },
    include: { participants: true },
  });
  const results: Phase2Result[] = matches.map((m) => {
    const winner = m.participants.find((p) => p.finishPosition === 1);
    const loser = m.participants.find((p) => p.finishPosition === 2);
    if (!winner || !loser) throw new Error(`Phase 2 match ${m.id} is missing a recorded result.`);
    return { matchId: m.kind as Phase2MatchId, winner: winner.babyId, loser: loser.babyId };
  });

  // Apply whatever placements are determined so far — 4th/3rd resolve
  // before the Grand Final does, and should nap those babies promptly
  // rather than waiting for the whole bracket to finish. computePhase2Placements
  // returns *every* placement determined so far on every call (not just
  // newly-determined ones), so this can re-run over a baby already
  // napped by an earlier confirmation in this bracket (e.g. GRAND_FINAL
  // resolving re-includes the LOSERS_R1 4th-place baby) — only notify
  // when this is the first time we're deciding this baby's fate.
  const placements = computePhase2Placements(results);
  for (const p of placements) {
    const before = await tx.baby.findUniqueOrThrow({ where: { id: p.babyId } });
    if (before.status !== "ACTIVE") continue; // already decided by an earlier confirmation

    await tx.baby.update({
      where: { id: p.babyId },
      data: { finalPlacement: p.place, status: p.place === 1 ? "CHAMPION" : "NAPPED" },
    });
    if (p.place === 1) collector.crownedBabyId = p.babyId;
    else collector.nappedBabies.push({ babyId: p.babyId, placement: p.place });
  }

  if (isPhase2Complete(results)) {
    await tx.playtime.update({ where: { id: playtimeId }, data: { status: "COMPLETE" } });
    return;
  }

  const babies = await tx.baby.findMany({ where: { playtimeId } });
  const seeds = reconstructSeeds(babies);
  const seedByBabyId = new Map(babies.map((b) => [b.id, b.seed]));

  const playable = getPlayablePhase2Matches(seeds, results);
  const existingPhase2Matches = await tx.match.findMany({
    where: { playtimeId, kind: { in: PHASE2_KINDS } },
  });
  const existingKinds = new Set(existingPhase2Matches.map((m) => m.kind));

  for (const p of playable) {
    const kind = p.matchId as MatchKind;
    if (existingKinds.has(kind)) continue; // already created (pending or confirmed)
    await createSimpleMatch(tx, playtimeId, kind, 1, null, [p.babyA, p.babyB], [
      seedByBabyId.get(p.babyA) ?? undefined,
      seedByBabyId.get(p.babyB) ?? undefined,
    ]);
  }
}

// ── Scheduling ────────────────────────────────────────────────────────

async function scheduleReadyMatches(tx: Tx, playtimeId: string, collector: NotificationCollector): Promise<void> {
  const playtime = await tx.playtime.findUniqueOrThrow({ where: { id: playtimeId } });

  const occupiedMatches = await tx.match.findMany({
    where: { playtimeId, status: { in: [MatchStatus.READY, MatchStatus.IN_PROGRESS] } },
    select: { stationNumber: true },
  });
  let freeStationCount = playtime.stationCount - occupiedMatches.length;

  const takenStations = new Set(occupiedMatches.map((m) => m.stationNumber).filter((n): n is number => n != null));
  const availableStations: number[] = [];
  for (let s = 1; s <= playtime.stationCount; s++) {
    if (!takenStations.has(s)) availableStations.push(s);
  }

  // Fetched (and priority-sorted) regardless of whether a station's
  // actually free right now — the common single-station case has zero
  // free stations almost the entire night (one match occupies the only
  // station until it resolves), which is exactly when the "up soon"
  // check below matters most; it can't be gated behind the same
  // early-return the READY-assignment loop used to have.
  const pending = await tx.match.findMany({
    where: { playtimeId, status: MatchStatus.PENDING },
    orderBy: { createdAt: "asc" },
  });
  const sorted = sortMatchesByPriority(pending);

  for (const match of sorted) {
    if (freeStationCount <= 0) break;
    const station = availableStations.shift();
    if (station === undefined) break;

    await tx.match.update({ where: { id: match.id }, data: { status: "READY", stationNumber: station } });
    await tx.matchEvent.create({
      data: { matchId: match.id, type: "READY", payload: {}, actorType: "SYSTEM" },
    });
    collector.readyMatchIds.add(match.id);
    freeStationCount -= 1;
  }

  // "Up soon" pre-notice — whichever still-PENDING match (after however
  // many just got READY above) is now the immediate next in line gets one
  // one-time heads-up, ahead of the real "you're up" push this function
  // already sends for real once it actually becomes READY.
  const nextUp = sorted.find((m) => !collector.readyMatchIds.has(m.id));
  if (nextUp && !nextUp.upSoonNotifiedAt) {
    await tx.match.update({ where: { id: nextUp.id }, data: { upSoonNotifiedAt: new Date() } });
    collector.upSoonMatchId = nextUp.id;
  }
}

/**
 * The fixed scheduling priority order (see KIND_PRIORITY above), exported
 * for reuse by ETA estimation (src/lib/baby-status.ts) — "matches queued
 * ahead of mine" needs the exact same ordering the scheduler itself uses.
 */
export function sortMatchesByPriority<T extends { kind: MatchKind; round: number; penIndex: number | null; createdAt: Date }>(
  matches: T[],
): T[] {
  return [...matches].sort((a, b) => {
    const pa = KIND_PRIORITY[a.kind];
    const pb = KIND_PRIORITY[b.kind];
    if (pa !== pb) return pa - pb;
    if (a.round !== b.round) return a.round - b.round;
    const pia = a.penIndex ?? 0;
    const pib = b.penIndex ?? 0;
    if (pia !== pib) return pia - pib;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// ── Small shared helpers ─────────────────────────────────────────────

async function createSimpleMatch(
  tx: Tx,
  playtimeId: string,
  kind: MatchKind,
  round: number,
  penIndex: number | null,
  babyIds: string[],
  seedsInMatch?: (number | undefined)[],
): Promise<void> {
  const match = await tx.match.create({
    data: { playtimeId, kind, round, penIndex, status: "PENDING" },
  });
  await tx.matchParticipant.createMany({
    data: babyIds.map((babyId, i) => ({
      matchId: match.id,
      babyId,
      seedInMatch: seedsInMatch?.[i] ?? null,
    })),
  });
  await tx.matchEvent.create({
    data: { matchId: match.id, type: "CREATED", payload: { babyIds }, actorType: "SYSTEM" },
  });
}

async function nextPlaypenRoundNumber(tx: Tx, playtimeId: string): Promise<number> {
  const result = await tx.match.aggregate({
    where: { playtimeId, kind: MatchKind.PLAYPEN },
    _max: { round: true },
  });
  return (result._max.round ?? 0) + 1;
}

async function getConfirmedPlaypenResults(tx: Tx, playtimeId: string): Promise<PenResult[]> {
  const matches = await tx.match.findMany({
    where: { playtimeId, kind: MatchKind.PLAYPEN, status: "CONFIRMED" },
    include: { participants: true },
  });
  return matches.map((m) => ({
    penId: m.id,
    size: m.participants.length,
    finishOrder: [...m.participants]
      .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
      .map((p) => p.babyId),
  }));
}

async function rankActiveBabyIds(tx: Tx, playtimeId: string, isTournamentStart: boolean): Promise<string[]> {
  const activeBabies = await tx.baby.findMany({
    where: { playtimeId, status: "ACTIVE" },
    orderBy: { registrationOrder: "asc" },
  });
  if (isTournamentStart) {
    // "Seed by registration order if there's no history yet."
    return activeBabies.map((b) => b.id);
  }
  const penResults = await getConfirmedPlaypenResults(tx, playtimeId);
  const scored = computeSeedingScore(
    activeBabies.map((b) => b.id),
    penResults,
  );
  return scored.map((s) => s.babyId); // already best-first
}

function reconstructSeeds(babies: { id: string; seed: number | null }[]): Phase2Seeds {
  const bySeed = new Map(babies.filter((b) => b.seed != null).map((b) => [b.seed as number, b.id]));
  const seed1 = bySeed.get(1);
  const seed2 = bySeed.get(2);
  const seed3 = bySeed.get(3);
  const seed4 = bySeed.get(4);
  if (!seed1 || !seed2 || !seed3 || !seed4) {
    throw new Error("reconstructSeeds: one or more of seeds 1-4 is missing for this playtime.");
  }
  return { seed1, seed2, seed3, seed4 };
}
