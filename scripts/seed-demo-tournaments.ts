// Seeds a spread of demo playtimes for looking at (and screenshotting)
// the bracket views/admin panel in every stage a real night can be in,
// without having to manually click a real tournament through each one.
// Idempotent: clears out its own previously-seeded playtimes (matched by
// the "Demo:" name prefix) first, rather than piling up on every re-run —
// same pattern as scripts/rehearsal-seed.ts, but that script plays a
// single tournament to completion; this one produces the *set* of
// tournaments you'd want open in different tabs to see the whole app:
//
//   - an empty draft (nobody checked in yet)
//   - a draft with a full nursery checked in, not started
//   - one tournament sitting live in each bracket-view column (Round 1,
//     Quarterfinals, Semifinals, Grand Final) — the column it's "in"
//     shows a realistic mix of finished/playing/ready/pending matches,
//     everything after it is still untouched
//   - one large tournament played all the way to a champion
//   - one small (round-robin) tournament played all the way to a champion
//
// Real-sounding names, a spread of avatars, and a spread of self-role
// labels (including plenty of babies left with no role at all, since
// that's the common case) — not just "Baby 1, Baby 2, ...", so the
// bracket view actually looks like a populated night out instead of
// placeholder data.
//
// Deliberately does NOT clean up after itself when it finishes (like
// rehearsal-seed.ts) — the whole point is to leave these on screen.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { startPlaytime, confirmMatchResult, markMatchInProgress, sortMatchesByPriority } from "../src/lib/playtime-lifecycle";
import { Game } from "../src/generated/prisma/enums";
import type { MatchKind } from "../src/generated/prisma/enums";
import { AVATAR_OPTIONS } from "../src/lib/avatars";
import { shortId } from "../src/lib/short-id";

const NAME_POOL = [
  "Fredrik",
  "Ivar",
  "Nils",
  "Petter",
  "Petra",
  "Helga",
  "Sigrid",
  "Magnus",
  "Astrid",
  "Bjørn",
  "Elise",
  "Torvald",
  "Liv",
  "Sander",
  "Maja",
  "Odin",
  "Frida",
  "Kasper",
  "Nora",
  "Viggo",
];

// `null` is deliberately common here too — most babies in practice never
// set a role label, so the demo data should mostly reflect that instead
// of every single one having a cute tag.
const ROLE_POOL: (string | null)[] = [
  null,
  "Big sister",
  null,
  "Little brother",
  "Regular",
  null,
  "Defending champ",
  "Rookie",
  null,
  "Wildcard",
  "Plus one",
  null,
];

const DEMO_PREFIX = "Demo:";

function pick<T>(pool: T[], i: number): T {
  return pool[i % pool.length]!;
}

async function ensureDemoAdmin() {
  const existing = await prisma.admin.findFirst();
  if (existing) return existing;
  return prisma.admin.create({
    data: {
      username: "demo-daddy",
      passwordHash: await hashPassword("demo-only"),
      name: "Demo Daddy",
      adminLinkToken: shortId(),
    },
  });
}

async function clearPreviousDemoData() {
  const previous = await prisma.playtime.findMany({ where: { name: { startsWith: DEMO_PREFIX } } });
  if (previous.length === 0) return;
  await prisma.playtime.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
  console.log(`Cleared ${previous.length} previously-seeded demo playtime(s).`);
}

async function createDemoPlaytime(opts: {
  name: string;
  game: Game;
  stationCount: number;
  babyCount: number;
}) {
  const playtime = await prisma.playtime.create({
    data: {
      name: `${DEMO_PREFIX} ${opts.name}`,
      game: opts.game,
      joinToken: shortId(),
      stationCount: opts.stationCount,
      defaultMatchDurationSec: opts.game === Game.MARIO_KART ? 480 : 360,
      status: "NURSERY_OPEN",
    },
  });

  // Shuffle which slice of the name pool + which avatar/role each baby
  // gets, so re-runs (and different-sized tournaments) don't all end up
  // with an identical "Fredrik is always avatar #1" look.
  const names = [...NAME_POOL].sort(() => Math.random() - 0.5).slice(0, opts.babyCount);
  const avatarStart = Math.floor(Math.random() * AVATAR_OPTIONS.length);
  const roleStart = Math.floor(Math.random() * ROLE_POOL.length);
  for (let i = 0; i < names.length; i++) {
    // Every 4th baby gets no avatar at all (falls back to the default
    // bottle icon) — another common real-world case worth showing.
    const avatarId = i % 4 === 3 ? null : pick(AVATAR_OPTIONS, avatarStart + i).id;
    await prisma.baby.create({
      data: {
        playtimeId: playtime.id,
        displayName: names[i],
        registrationOrder: i + 1,
        avatarId,
        selfRoleLabel: pick(ROLE_POOL, roleStart + i),
      },
    });
  }

  console.log(`Created "${playtime.name}" (${opts.game}, ${opts.babyCount} babies) — slug ${playtime.slugNumber}`);
  return playtime;
}

/**
 * Confirms matches (random finishing order, admin actor) in real
 * scheduling-priority order until the next playable match's kind is one
 * of `stopBeforeKinds` — i.e. drives the tournament right up to the edge
 * of a bracket-view column without entering it. No-ops (returns
 * immediately) if the playtime is already COMPLETE.
 */
async function playUntil(playtimeId: string, adminId: string, stopBeforeKinds: Set<MatchKind>): Promise<void> {
  let guard = 0;
  while (true) {
    guard += 1;
    if (guard > 300) throw new Error(`playUntil: stuck after ${guard} iterations on playtime ${playtimeId}.`);

    const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
    if (playtime.status === "COMPLETE") return;

    const playable = await prisma.match.findMany({
      where: { playtimeId, status: { in: ["PENDING", "READY", "IN_PROGRESS"] } },
      include: { participants: true },
    });
    if (playable.length === 0) return; // nothing left to drive forward with

    const next = sortMatchesByPriority(playable)[0]!;
    if (stopBeforeKinds.has(next.kind)) return;

    const ordered = [...next.participants].sort(() => Math.random() - 0.5).map((p) => p.babyId);
    await confirmMatchResult({ matchId: next.id, orderedBabyIds: ordered, actor: { type: "ADMIN", adminId } });
  }
}

/**
 * Plays the whole tournament to a champion — same as playUntil with an
 * empty stop set, just named for what it's actually doing at the call
 * site.
 */
async function playToCompletion(playtimeId: string, adminId: string): Promise<void> {
  await playUntil(playtimeId, adminId, new Set());
}

/**
 * Once `playUntil` has stopped right at the edge of a column, this gives
 * that column a realistic mix of statuses instead of leaving every match
 * in it identically PENDING/READY: confirms the first playable match
 * (-> FINISHED) and, if a second one is now playable, marks it
 * IN_PROGRESS (-> PLAYING, as if someone just tapped "We're playing") —
 * so the column reads as a night actually in progress, not a frozen
 * snapshot. Leaves anything beyond those two exactly as the scheduler
 * left it (READY/PENDING).
 */
async function giveColumnSomeLife(playtimeId: string, adminId: string): Promise<void> {
  const first = await prisma.match.findFirst({
    where: { playtimeId, status: { in: ["PENDING", "READY", "IN_PROGRESS"] } },
    include: { participants: true },
    orderBy: { createdAt: "asc" },
  });
  if (!first) return;
  const orderedFirst = [...first.participants].sort(() => Math.random() - 0.5).map((p) => p.babyId);
  await confirmMatchResult({ matchId: first.id, orderedBabyIds: orderedFirst, actor: { type: "ADMIN", adminId } });

  const second = await prisma.match.findFirst({
    where: { playtimeId, id: { not: first.id }, status: "READY" },
    include: { participants: true },
    orderBy: { createdAt: "asc" },
  });
  if (second?.participants[0]) {
    await markMatchInProgress(second.id, second.participants[0].babyId);
  }
}

async function main() {
  const admin = await ensureDemoAdmin();
  await clearPreviousDemoData();

  // 1. Empty draft — nobody's checked in yet.
  await createDemoPlaytime({ name: "Empty draft", game: Game.MARIO_KART, stationCount: 1, babyCount: 0 });

  // 2. Full draft — a whole nursery checked in, nobody's started.
  await createDemoPlaytime({ name: "Full nursery, not started", game: Game.SUPER_SMASH, stationCount: 2, babyCount: 14 });

  // 3. Round 1 (playpens) column, live.
  {
    const pt = await createDemoPlaytime({ name: "Round 1 under way", game: Game.MARIO_KART, stationCount: 1, babyCount: 7 });
    await startPlaytime(pt.id);
    await giveColumnSomeLife(pt.id, admin.id);
  }

  // 4. Quarterfinals column, live.
  {
    const pt = await createDemoPlaytime({ name: "Quarterfinals under way", game: Game.SUPER_SMASH, stationCount: 2, babyCount: 9 });
    await startPlaytime(pt.id);
    await playUntil(pt.id, admin.id, new Set(["QF1", "QF2"] as MatchKind[]));
    await giveColumnSomeLife(pt.id, admin.id);
  }

  // 5. Semifinals column (Winner/Losers playpen), live.
  {
    const pt = await createDemoPlaytime({ name: "Semifinals under way", game: Game.MARIO_KART, stationCount: 2, babyCount: 11 });
    await startPlaytime(pt.id);
    await playUntil(pt.id, admin.id, new Set(["WINNERS_FINAL", "LOSERS_R1"] as MatchKind[]));
    await giveColumnSomeLife(pt.id, admin.id);
  }

  // 6. Grand Final column, live.
  {
    const pt = await createDemoPlaytime({ name: "Grand Final under way", game: Game.SUPER_SMASH, stationCount: 1, babyCount: 8 });
    await startPlaytime(pt.id);
    await playUntil(pt.id, admin.id, new Set(["GRAND_FINAL"] as MatchKind[]));
    // Left as READY, not started — "everyone's watching the last match
    // about to begin" reads better than jumping straight to PLAYING.
  }

  // 7. Large tournament, finished.
  {
    const pt = await createDemoPlaytime({ name: "Big night, finished", game: Game.MARIO_KART, stationCount: 2, babyCount: 16 });
    await startPlaytime(pt.id);
    await playToCompletion(pt.id, admin.id);
  }

  // 8. Small (round-robin) tournament, finished.
  {
    const pt = await createDemoPlaytime({ name: "Small round-robin, finished", game: Game.SUPER_SMASH, stationCount: 1, babyCount: 3 });
    await startPlaytime(pt.id);
    await playToCompletion(pt.id, admin.id);
  }

  console.log("\nDone — open /playtimes to see all of them.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
