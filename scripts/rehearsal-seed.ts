// Generates a fake 13-baby playtime and plays it to completion through
// the real lifecycle functions (the same code path the admin panel and
// baby self-report use) — so you can rehearse the whole flow, and see
// what a finished playtime looks like in the admin panel and on the
// spectator screen, before the actual event. Safe to re-run: it clears
// out its own previous rehearsal playtime first, rather than piling up.
//
// This deliberately does NOT clean up after itself when it finishes —
// unlike the throwaway smoke-test scripts used during development, the
// whole point here is to leave something on screen for you to look at.
//
// Runs instantly by default (good for quick DB seeding). Pass
// --delay=<ms> to pace it out instead — e.g. --delay=2500 — so you can
// have /live/<slug> open in a tab and watch each match land as the
// spectator poller (3s interval) picks it up, instead of the whole
// tournament finishing before the page loads.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { startPlaytime, confirmMatchResult } from "../src/lib/playtime-lifecycle";
import { Game } from "../src/generated/prisma/enums";
import { shortId } from "../src/lib/short-id";

function parseDelayMs(): number {
  const arg = process.argv.find((a) => a.startsWith("--delay="));
  const ms = arg ? Number(arg.slice("--delay=".length)) : 0;
  return Number.isFinite(ms) && ms >= 0 ? ms : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REHEARSAL_NAME = "Rehearsal Night";

const BABY_NAMES = [
  "Pixel",
  "Waffles",
  "Turbo",
  "Biscuit",
  "Ziggy",
  "Nugget",
  "Marbles",
  "Sprinkle",
  "Comet",
  "Peanut",
  "Doodle",
  "Squish",
  "Momo",
];

async function ensureRehearsalAdmin() {
  const existing = await prisma.admin.findFirst();
  if (existing) return existing;
  return prisma.admin.create({
    data: {
      username: "rehearsal-daddy",
      passwordHash: await hashPassword("rehearsal-only"),
      name: "Rehearsal Daddy",
      adminLinkToken: shortId(),
    },
  });
}

async function main() {
  const delayMs = parseDelayMs();
  const admin = await ensureRehearsalAdmin();

  const previous = await prisma.playtime.findFirst({ where: { name: REHEARSAL_NAME } });
  if (previous) {
    await prisma.playtime.delete({ where: { id: previous.id } });
    console.log(`Cleared out the previous "${REHEARSAL_NAME}" so this run starts fresh.`);
  }

  const game = Math.random() < 0.5 ? Game.MARIO_KART : Game.SUPER_SMASH;
  const playtime = await prisma.playtime.create({
    data: {
      name: REHEARSAL_NAME,
      game,
      joinToken: shortId(),
      stationCount: 2, // exercises the multi-station scheduler, not just the N=1 default
      defaultMatchDurationSec: game === Game.MARIO_KART ? 480 : 360,
      status: "NURSERY_OPEN",
    },
  });
  console.log(`Created "${REHEARSAL_NAME}" (${game}) — /live/${playtime.slugNumber}`);

  for (let i = 0; i < BABY_NAMES.length; i++) {
    await prisma.baby.create({
      data: { playtimeId: playtime.id, displayName: BABY_NAMES[i], registrationOrder: i + 1 },
    });
  }
  console.log(`Registered ${BABY_NAMES.length} babies: ${BABY_NAMES.join(", ")}`);

  if (delayMs > 0) {
    console.log(
      `\n⏸  Pacing this out at ${delayMs}ms/match — open /live/${playtime.slugNumber} now if you want to watch.`,
    );
    await sleep(delayMs);
  }

  await startPlaytime(playtime.id);
  console.log("Started the playtime.\n");

  // Play out every match as it becomes playable — a mix of "favourite
  // wins" and genuine upsets, so the seeding/placement logic gets
  // exercised the way a real night would, not just the happy path.
  let guard = 0;
  while (true) {
    guard += 1;
    if (guard > 200) throw new Error("Rehearsal did not complete in a reasonable number of steps — investigate.");

    const current = await prisma.playtime.findUniqueOrThrow({ where: { id: playtime.id } });
    if (current.status === "COMPLETE") break;

    const playable = await prisma.match.findMany({
      where: {
        playtimeId: playtime.id,
        status: { in: ["PENDING", "READY", "IN_PROGRESS"] },
      },
      include: { participants: { include: { baby: true } } },
      take: 1,
      orderBy: { createdAt: "asc" },
    });
    if (playable.length === 0) {
      throw new Error("No playable match but the playtime isn't COMPLETE — the lifecycle got stuck.");
    }

    const match = playable[0]!;
    const shuffled = [...match.participants].sort(() => Math.random() - 0.5);
    const orderedBabyIds = shuffled.map((p) => p.babyId);

    await confirmMatchResult({ matchId: match.id, orderedBabyIds, actor: { type: "ADMIN", adminId: admin.id } });
    const names = shuffled.map((p) => p.baby.displayName).join(" > ");
    console.log(`${match.kind} round ${match.round}: ${names}`);

    if (delayMs > 0) await sleep(delayMs);
  }

  const finalBabies = await prisma.baby.findMany({
    where: { playtimeId: playtime.id },
    orderBy: { finalPlacement: "asc" },
  });
  const champion = finalBabies.find((b) => b.status === "CHAMPION");

  console.log("\n🌟 Rehearsal complete! 🌟");
  console.log(`Best Baby: ${champion?.displayName ?? "(none?!)"}`);
  console.log("\nFinal standings:");
  for (const b of finalBabies) {
    console.log(`  ${b.finalPlacement ?? "?"}. ${b.displayName}${b.status === "CHAMPION" ? " 🌟" : ""}`);
  }
  console.log(
    `\nLook at it: /admin/playtimes/${playtime.id} (admin panel) or /live/${playtime.slugNumber} (spectator).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
