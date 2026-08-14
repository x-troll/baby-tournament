"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentBaby, createBabySession, createMagicLinkToken, WEB_BOOKMARK_LINK_DURATION_SECONDS } from "@/lib/baby-auth";
import { createBabyForPlaytime } from "@/lib/baby-registration";
import { parseSlugNumber } from "@/lib/slug-number";
import type { Playtime } from "@/generated/prisma/client";

/**
 * Shared tail of both join paths below: create a nameless Baby, log this
 * browser in as them (swapping out whichever baby session was active —
 * same one-cookie model as everywhere else; the previous baby stays
 * reachable via that playtime's own link, per not-signed-in's copy),
 * mint the bookmark token, and hand off to requireBaby's register-gate.
 * createBabyForPlaytime rejects (with RegistrationClosedError) once the
 * target playtime isn't NURSERY_OPEN anymore, and allocates
 * registrationOrder atomically — no separate status check needed here.
 */
async function finishWebsiteJoin(playtime: Playtime): Promise<never> {
  const baby = await createBabyForPlaytime(playtime.id, {});
  await createBabySession(baby.id);

  // A separate, much longer-lived token purely for the bookmark: the
  // page they land on next keeps this in its URL so re-visiting it
  // later (cleared cookies, another device) still logs them back in —
  // see requireBabyWithToken in baby-auth.ts.
  const bookmarkToken = await createMagicLinkToken(baby.id, WEB_BOOKMARK_LINK_DURATION_SECONDS);

  revalidatePath(`/playtimes/${playtime.slugNumber}`);
  // requireBaby's register-gate (baby-auth.ts) takes it from here —
  // this baby has no displayName yet, so /playtimes/[slug] redirects
  // straight to /playtimes/[slug]/register.
  redirect(`/playtimes/${playtime.slugNumber}?token=${bookmarkToken}`);
}

// The one intentionally-public mutation in this app — no requireAdmin,
// no requireBaby, since the whole point is letting someone with no
// account yet create one. joinToken is the only gate, same secret the
// Telegram flow already trusts (see src/lib/telegram/commands.ts's
// handleBabyStart, which this mirrors: create a nameless Baby, nothing
// more — the actual registration form (name/avatar/role, plus the
// no-show waiver since this baby has no telegramChatId) lives on the
// one shared /playtimes/[slug]/register page every nameless Baby lands
// on, via requireBaby's gate in baby-auth.ts.
export async function joinViaWebsiteAction(joinToken: string): Promise<void> {
  const playtime = await prisma.playtime.findUnique({ where: { joinToken } });
  if (!playtime) throw new Error("This invite link isn't valid. Ask for a fresh QR code.");
  await finishWebsiteJoin(playtime);
}

/**
 * The "More playtime!" modal's join action (src/components/baby/
 * MorePlaytimesModal.tsx) — same shape as joinViaWebsiteAction, but
 * keyed by the public slugNumber instead of the secret joinToken: this
 * is only ever reached from a server-rendered list that's already
 * scoped to real NURSERY_OPEN playtimes for an already-signed-in baby,
 * unlike the public /join/[token] route, so there's no invite secret to
 * check here — requireBaby-style "must already be signed in as someone"
 * is enough of a gate.
 */
export async function joinAnotherPlaytimeAction(targetSlug: string): Promise<void> {
  const currentBaby = await getCurrentBaby();
  if (!currentBaby) throw new Error("Sign in first.");

  const slugNumber = parseSlugNumber(targetSlug);
  const playtime = slugNumber === null ? null : await prisma.playtime.findUnique({ where: { slugNumber } });
  if (!playtime) throw new Error("That playtime doesn't exist.");

  await finishWebsiteJoin(playtime);
}
