"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBabySession, createMagicLinkToken, WEB_BOOKMARK_LINK_DURATION_SECONDS } from "@/lib/baby-auth";

// The one intentionally-public mutation in this app — no requireAdmin,
// no requireBaby, since the whole point is letting someone with no
// account yet create one. joinToken is the only gate, same secret the
// Telegram flow already trusts (see src/lib/telegram/commands.ts's
// handleBabyStart, which this mirrors closely).
export async function joinViaWebsiteAction(joinToken: string, formData: FormData): Promise<void> {
  const playtime = await prisma.playtime.findUnique({ where: { joinToken } });
  if (!playtime) throw new Error("This invite link isn't valid — ask for a fresh QR code.");
  if (playtime.status !== "NURSERY_OPEN") {
    throw new Error("Registration's closed — this tournament has already started.");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new Error("Please tell us what to call you.");
  if (formData.get("acceptedWaiver") !== "on") {
    throw new Error("Please check the box confirming you'll watch this page yourself.");
  }

  const lastBaby = await prisma.baby.findFirst({
    where: { playtimeId: playtime.id },
    orderBy: { registrationOrder: "desc" },
  });

  // telegramChatId stays null — exactly the same shape as an admin's
  // manual add (addBabyManuallyAction in playtimes.ts). Every Telegram
  // notification sender already no-ops on a null telegramChatId, so
  // this baby simply never gets pinged, which is the whole trade-off
  // the waiver checkbox above is warning them about.
  const baby = await prisma.baby.create({
    data: {
      playtimeId: playtime.id,
      displayName,
      registrationOrder: (lastBaby?.registrationOrder ?? 0) + 1,
    },
  });

  // This is already a live browser request, unlike Telegram's — no
  // magic-link round trip needed to get *this* visit logged in.
  await createBabySession(baby.id);

  // A separate, much longer-lived token purely for the bookmark: the
  // page they land on next keeps this in its URL so re-visiting it
  // later (cleared cookies, another device) still logs them back in —
  // see requireBabyWithToken in baby-auth.ts.
  const bookmarkToken = await createMagicLinkToken(baby.id, WEB_BOOKMARK_LINK_DURATION_SECONDS);

  revalidatePath(`/admin/playtimes/${playtime.id}`);
  redirect(`/play/${playtime.slugNumber}?token=${bookmarkToken}`);
}
