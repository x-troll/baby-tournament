"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBabySession, createMagicLinkToken, WEB_BOOKMARK_LINK_DURATION_SECONDS } from "@/lib/baby-auth";
import { createBabyForPlaytime } from "@/lib/baby-registration";

// The one intentionally-public mutation in this app — no requireAdmin,
// no requireBaby, since the whole point is letting someone with no
// account yet create one. joinToken is the only gate, same secret the
// Telegram flow already trusts (see src/lib/telegram/commands.ts's
// handleBabyStart, which this mirrors: create a nameless Baby, nothing
// more — the actual registration form (name/avatar/role, plus the
// no-show waiver since this baby has no telegramChatId) lives on the
// one shared /play/[slug]/register page every nameless Baby lands on,
// via requireBaby's gate in baby-auth.ts.
export async function joinViaWebsiteAction(joinToken: string): Promise<void> {
  const playtime = await prisma.playtime.findUnique({ where: { joinToken } });
  if (!playtime) throw new Error("This invite link isn't valid. Ask for a fresh QR code.");

  // telegramChatId stays null — exactly the same shape as an admin's
  // manual add (addBabyManuallyAction in playtimes.ts). Every Telegram
  // notification sender already no-ops on a null telegramChatId, so
  // this baby simply never gets pinged, which is exactly what the
  // waiver checkbox on /register warns them about.
  // createBabyForPlaytime rejects (with this exact wording) once the
  // playtime isn't NURSERY_OPEN anymore, and allocates registrationOrder
  // atomically — no separate status check needed here.
  const baby = await createBabyForPlaytime(playtime.id, {});

  // This is already a live browser request, unlike Telegram's — no
  // magic-link round trip needed to get *this* visit logged in.
  await createBabySession(baby.id);

  // A separate, much longer-lived token purely for the bookmark: the
  // page they land on next keeps this in its URL so re-visiting it
  // later (cleared cookies, another device) still logs them back in —
  // see requireBabyWithToken in baby-auth.ts.
  const bookmarkToken = await createMagicLinkToken(baby.id, WEB_BOOKMARK_LINK_DURATION_SECONDS);

  revalidatePath(`/playtimes/${playtime.slugNumber}`);
  // requireBaby's register-gate (baby-auth.ts) takes it from here —
  // this baby has no displayName yet, so /play/[slug] redirects
  // straight to /play/[slug]/register.
  redirect(`/play/${playtime.slugNumber}?token=${bookmarkToken}`);
}
