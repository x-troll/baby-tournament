// Like `npm run rehearsal`, but wires in a REAL Telegram account (or two)
// instead of only fake data — links an admin so you receive real "help
// request"/dispute pushes as Daddy, and optionally reserves one baby
// slot for you to join and play for real (drag-to-reorder, the gold-star
// button, the 60s auto-confirm timer, all genuinely exercised, not
// simulated) while the other 12 babies auto-play in the background.
//
// Requires TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and a
// NEXT_PUBLIC_APP_URL Telegram can actually reach (not localhost) — see
// the README's Telegram setup section. Usage:
//
//   npm run rehearsal:telegram              # link yourself as Daddy only
//   npm run rehearsal:telegram -- --with-baby   # also join as a real baby
//   npm run rehearsal:telegram -- --delay=2500  # pace the fake babies out so /live updates visibly
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
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

const REHEARSAL_NAME = "Rehearsal Night (Telegram)";
const FAKE_BABY_NAMES = [
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
];

const withBaby = process.argv.includes("--with-baby");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} — see the README's "Setting up the Telegram bot" section.`);
    process.exit(1);
  }
  return value;
}

/** Polls `check` every 2s, printing a heartbeat every 10s, until it returns truthy or `timeoutMs` elapses. */
async function waitFor<T>(label: string, check: () => Promise<T | null>, timeoutMs: number): Promise<T> {
  const start = Date.now();
  let lastBeat = 0;
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) return result;
    if (Date.now() - lastBeat > 10_000) {
      const secondsLeft = Math.round((timeoutMs - (Date.now() - start)) / 1000);
      console.log(`  ⏳ still waiting — ${label} (${secondsLeft}s left)`);
      lastBeat = Date.now();
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

async function main() {
  const delayMs = parseDelayMs();
  const botUsername = requireEnv("TELEGRAM_BOT_USERNAME");
  requireEnv("TELEGRAM_BOT_TOKEN");
  const appUrl = requireEnv("NEXT_PUBLIC_APP_URL");
  if (appUrl.includes("localhost")) {
    console.error(
      "NEXT_PUBLIC_APP_URL is still localhost — Telegram's servers can't reach that. " +
        "Set up a tunnel (see README) and set this to the public URL first.",
    );
    process.exit(1);
  }

  // ── Step 1: link yourself as Daddy ──
  let admin = await prisma.admin.findFirst();
  if (!admin) {
    const username = requireEnv("ADMIN_USERNAME");
    const password = requireEnv("ADMIN_PASSWORD");
    admin = await prisma.admin.create({
      data: { username, passwordHash: await bcrypt.hash(password, 12), name: "Daddy", adminLinkToken: shortId() },
    });
    console.log(`Created admin ${username} (no admin existed yet).`);
  }

  if (admin.telegramChatId) {
    console.log(`✓ ${admin.name} is already linked to Telegram — skipping.`);
  } else {
    const adminLink = `https://t.me/${botUsername}?start=admin_${admin.adminLinkToken}`;
    console.log(`\n📱 Open this in Telegram to link yourself as Daddy:\n   ${adminLink}\n`);
    await waitFor(
      "you tapping /start on the admin link",
      async () => {
        const fresh = await prisma.admin.findUniqueOrThrow({ where: { id: admin!.id } });
        return fresh.telegramChatId ? fresh : null;
      },
      5 * 60_000,
    );
    console.log("✓ Linked! You'll get help-request/dispute pushes here from now on.\n");
  }

  // ── Step 2: fresh playtime ──
  await prisma.playtime.deleteMany({ where: { name: REHEARSAL_NAME } });
  const game = Math.random() < 0.5 ? Game.MARIO_KART : Game.SUPER_SMASH;
  const playtime = await prisma.playtime.create({
    data: {
      name: REHEARSAL_NAME,
      game,
      joinToken: shortId(),
      stationCount: 2,
      defaultMatchDurationSec: game === Game.MARIO_KART ? 480 : 360,
      status: "NURSERY_OPEN",
    },
  });
  console.log(`Created "${REHEARSAL_NAME}" (${game}).`);

  for (let i = 0; i < FAKE_BABY_NAMES.length; i++) {
    await prisma.baby.create({
      data: { playtimeId: playtime.id, displayName: FAKE_BABY_NAMES[i], registrationOrder: i + 1 },
    });
  }
  console.log(`Registered ${FAKE_BABY_NAMES.length} fake babies.`);

  // ── Step 3: optionally join as a real baby too ──
  let realBabyId: string | null = null;
  if (withBaby) {
    const joinLink = `https://t.me/${botUsername}?start=${playtime.joinToken}`;
    console.log(`\n📱 Open this in Telegram to join as a real baby (same account is fine):\n   ${joinLink}\n`);
    console.log('   The bot will ask for a display name — send it back as a normal message.\n');

    const realBaby = await waitFor(
      "you joining and sending a display name",
      async () =>
        prisma.baby.findFirst({
          where: { playtimeId: playtime.id, displayName: { not: null }, registrationOrder: { gt: FAKE_BABY_NAMES.length } },
        }),
      5 * 60_000,
    );
    realBabyId = realBaby.id;
    console.log(`✓ You're checked in as "${realBaby.displayName}"!\n`);
  }

  // ── Step 4: start, then play everything except your own matches ──
  if (delayMs > 0) {
    console.log(`\n⏸  Pacing fake babies at ${delayMs}ms/match — open /live/${playtime.slugNumber} now if you want to watch.`);
    await sleep(delayMs);
  }
  await startPlaytime(playtime.id);
  console.log("Started the playtime.\n");

  let guard = 0;
  while (true) {
    guard += 1;
    if (guard > 300) throw new Error("Rehearsal did not complete in a reasonable number of steps.");

    const current = await prisma.playtime.findUniqueOrThrow({ where: { id: playtime.id } });
    if (current.status === "COMPLETE") break;

    const playable = await prisma.match.findMany({
      where: { playtimeId: playtime.id, status: { in: ["PENDING", "READY", "IN_PROGRESS"] } },
      include: { participants: { include: { baby: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (playable.length === 0) {
      throw new Error("No playable match but the playtime isn't COMPLETE — the lifecycle got stuck.");
    }

    // Only treat it as "your turn" once the match is actually READY/
    // IN_PROGRESS — if it's still PENDING (not yet scheduled to
    // a station), nobody has pushed you anything yet, so fall through to
    // auto-playing *other* matches and let the scheduler catch up
    // naturally, the same way it would for a real crowd of babies.
    const yourActiveMatch = realBabyId
      ? playable.find((m) => m.status !== "PENDING" && m.participants.some((p) => p.babyId === realBabyId))
      : undefined;

    if (yourActiveMatch) {
      const opponents = yourActiveMatch.participants
        .filter((p) => p.babyId !== realBabyId)
        .map((p) => p.baby.displayName)
        .join(", ");
      console.log(`\n🎮 It's your match! (${yourActiveMatch.kind} round ${yourActiveMatch.round}, vs ${opponents})`);
      console.log("   Play it for real via the Telegram push / your browser session — waiting for you to report it.\n");
      await waitFor(
        "your match being confirmed (report it, then confirm/wait 60s)",
        async () => {
          const fresh = await prisma.match.findUniqueOrThrow({ where: { id: yourActiveMatch.id } });
          return fresh.status === "CONFIRMED" ? fresh : null;
        },
        10 * 60_000,
      );
      console.log("✓ Your match resolved!\n");
      continue;
    }

    // Auto-play the next fake-babies-only match — never touch your own
    // match even while it's still PENDING (leave it for the scheduler).
    const autoMatch = playable.find(
      (m) => !(realBabyId && m.participants.some((p) => p.babyId === realBabyId)),
    );
    if (!autoMatch) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    const shuffled = [...autoMatch.participants].sort(() => Math.random() - 0.5);
    await confirmMatchResult({
      matchId: autoMatch.id,
      orderedBabyIds: shuffled.map((p) => p.babyId),
      actor: { type: "ADMIN", adminId: admin.id },
    });
    console.log(`${autoMatch.kind} round ${autoMatch.round}: ${shuffled.map((p) => p.baby.displayName).join(" > ")}`);

    if (delayMs > 0) await sleep(delayMs);
  }

  const finalBabies = await prisma.baby.findMany({ where: { playtimeId: playtime.id }, orderBy: { finalPlacement: "asc" } });
  const champion = finalBabies.find((b) => b.status === "CHAMPION");

  console.log("\n🌟 Rehearsal complete! 🌟");
  console.log(`Best Baby: ${champion?.displayName ?? "(none?!)"}`);
  console.log("\nFinal standings:");
  for (const b of finalBabies) {
    const marker = b.id === realBabyId ? "  ← you" : "";
    console.log(`  ${b.finalPlacement ?? "?"}. ${b.displayName}${b.status === "CHAMPION" ? " 🌟" : ""}${marker}`);
  }
  console.log(`\n/admin/playtimes/${playtime.id} · /live/${playtime.slugNumber}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
