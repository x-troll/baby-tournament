// Seeds real data directly via the DB/lifecycle layer (fast, reliable —
// not driven through the UI), then uses one real browser sign-in to
// capture storageState for the admin and baby sessions the spec files
// reuse. Playwright's addCookies() could sign a JWT by hand instead, but
// driving the actual login form once here is simpler and doubles as a
// smoke check that login itself still works.
import "dotenv/config";
import { chromium } from "@playwright/test";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../src/lib/prisma";
import { startPlaytime, confirmMatchResult } from "../../src/lib/playtime-lifecycle";
import { Game } from "../../src/generated/prisma/enums";

// Not importing hashPassword from src/lib/auth.ts here — that module also
// exports session helpers that import "next/headers", which only
// resolves inside Next's own module system. Playwright's test runner
// loads this file through plain Node/ESM, which can't resolve it (tsx,
// used by the other standalone scripts, tolerates it; Playwright's
// loader doesn't). Inlining the one function actually needed avoids
// pulling that import in transitively.
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

const ADMIN_EMAIL = "a11y-test-admin@example.com";
const ADMIN_PASSWORD = "a11y-test-password";
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".out");

export default async function globalSetup() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let admin = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    admin = await prisma.admin.create({
      data: { email: ADMIN_EMAIL, passwordHash: await hashPassword(ADMIN_PASSWORD), name: "A11y Test Daddy" },
    });
  }

  await prisma.playtime.deleteMany({ where: { name: "A11y Test Playtime" } });
  const playtime = await prisma.playtime.create({
    data: {
      name: "A11y Test Playtime",
      game: Game.MARIO_KART,
      slug: `a11y-test-${Date.now()}`,
      stationCount: 1,
      defaultMatchDurationSec: 480,
      status: "NURSERY_OPEN",
      rulesOverrideNote: "3 races per match tonight",
    },
  });

  const names = ["Sam", "Alex", "Jo", "Kai", "Robin", "Val"];
  for (let i = 0; i < names.length; i++) {
    await prisma.baby.create({ data: { playtimeId: playtime.id, displayName: names[i], registrationOrder: i + 1 } });
  }

  await startPlaytime(playtime.id);

  // Confirm one round-1 pen so the star chart has a napped baby and a
  // gold star to render — an empty-state screen isn't very representative.
  const firstMatch = await prisma.match.findFirstOrThrow({
    where: { playtimeId: playtime.id, kind: "PLAYPEN" },
    include: { participants: true },
  });
  await confirmMatchResult({
    matchId: firstMatch.id,
    orderedBabyIds: firstMatch.participants.map((p) => p.babyId),
    actor: { type: "ADMIN", adminId: admin.id },
  });

  const previewBaby = await prisma.baby.findFirstOrThrow({ where: { playtimeId: playtime.id, status: "ACTIVE" } });

  // ── Capture real signed-in sessions via the actual UI ──
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${baseURL}/admin/login`);
  await adminPage.fill("#email", ADMIN_EMAIL);
  await adminPage.fill("#password", ADMIN_PASSWORD);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL(`${baseURL}/admin`);
  await adminContext.storageState({ path: path.join(OUT_DIR, "admin-storage-state.json") });

  // The baby session cookie is separate from the admin one (different
  // cookie names, see src/lib/baby-auth.ts) — the admin context can hold
  // both at once, so "Preview" from within it is enough.
  await adminPage.goto(`${baseURL}/admin/playtimes/${playtime.id}`);
  await adminPage
    .locator("tr", { hasText: previewBaby.displayName ?? "" })
    .locator('button:has-text("Preview")')
    .click();
  await adminPage.waitForURL(/\/play\//);
  await adminContext.storageState({ path: path.join(OUT_DIR, "baby-storage-state.json") });

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, "fixtures.json"),
    JSON.stringify({ playtimeId: playtime.id, playtimeSlug: playtime.slug, adminId: admin.id }, null, 2),
  );
}
