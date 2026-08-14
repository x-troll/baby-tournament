"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBaby, requireBabyForRegistration } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { SELF_ROLE_OPTIONS } from "@/lib/baby-terminology";

export interface UpdateBabyProfileState {
  error?: string;
  /** Set on a successful save — SettingsForm.tsx uses this both to flash a "Saved!" banner and as a remount key for the form below it (see that file for why the remount matters). */
  savedAt?: number;
  saved?: {
    displayName: string;
    avatarId: string | null;
    selfRoleLabel: string | null;
    allowExplicitMessages: boolean;
  };
}

/**
 * Editing anytime after registration — same fields as
 * completeRegistrationAction below, but every field here stays
 * optional/clearable (display name is the one exception: never allowed
 * to go blank, since it's shown everywhere once set).
 *
 * `(prevState, formData) => State` rather than plain `(formData) =>
 * void` — driven by useActionState in SettingsForm.tsx, not a bare
 * `<form action>`, so the page can show a save confirmation and (more
 * importantly) so the form's uncontrolled fields can be deliberately
 * remounted with the values that actually got saved. Without that,
 * React ignores a changed `defaultValue`/`defaultChecked` on an
 * already-mounted element — after Next revalidates this route post-save,
 * fields would appear to silently "revert" to whatever was there before
 * the edit, even though the save itself succeeded.
 */
export async function updateBabyProfileAction(
  slug: string,
  _prevState: UpdateBabyProfileState,
  formData: FormData,
): Promise<UpdateBabyProfileState> {
  const baby = await requireBaby(slug);

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return { error: "Please tell us what to call you." };

  const avatarIdRaw = String(formData.get("avatarId") ?? "");
  const avatarId = AVATAR_OPTIONS.some((a) => a.id === avatarIdRaw) ? avatarIdRaw : null;
  const selfRoleLabelRaw = String(formData.get("selfRoleLabel") ?? "");
  const selfRoleLabel = (SELF_ROLE_OPTIONS as readonly string[]).includes(selfRoleLabelRaw) ? selfRoleLabelRaw : null;
  const allowExplicitMessages = formData.get("allowExplicitMessages") === "on";

  await prisma.baby.update({
    where: { id: baby.id },
    data: { displayName, avatarId, selfRoleLabel, allowExplicitMessages },
  });

  revalidatePath(`/playtimes/${slug}`);
  revalidatePath(`/playtimes/${slug}/settings`);

  return { savedAt: Date.now(), saved: { displayName, avatarId, selfRoleLabel, allowExplicitMessages } };
}

/**
 * One-time required registration — the page every nameless Baby gets
 * funneled to (see requireBaby's gate in baby-auth.ts), reached either
 * via a Telegram magic link or straight off the website /join flow.
 * Name/avatar/self-role are all required here (unlike the settings
 * page's "optional, defaults are fine" stance) since this is the one
 * point every baby passes through before playing at all. The waiver
 * checkbox only applies — and is only validated — for babies with no
 * telegramChatId, who get no turn notifications.
 */
export async function completeRegistrationAction(
  slug: string,
  playerPreview: boolean,
  formData: FormData,
): Promise<void> {
  const baby = await requireBabyForRegistration(slug);

  // The baby row itself can predate the tournament starting (created the
  // moment they tapped the Telegram link or hit /join), but finishing
  // registration — the step that makes them a real, counted participant
  // — shouldn't still be possible once the bracket's already running.
  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: baby.playtimeId } });
  if (playtime.status !== "NURSERY_OPEN") {
    throw new Error("This tournament has already started, registration's closed.");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new Error("Please tell us what to call you.");

  const avatarId = String(formData.get("avatarId") ?? "");
  if (!AVATAR_OPTIONS.some((a) => a.id === avatarId)) throw new Error("Please pick a picture.");

  const selfRoleLabel = String(formData.get("selfRoleLabel") ?? "");
  if (!(SELF_ROLE_OPTIONS as readonly string[]).includes(selfRoleLabel)) throw new Error("Please pick a role.");

  if (!baby.telegramChatId && formData.get("acceptedWaiver") !== "on") {
    throw new Error("Please check the box confirming you'll watch this page yourself.");
  }

  const allowExplicitMessages = formData.get("allowExplicitMessages") === "on";

  await prisma.baby.update({
    where: { id: baby.id },
    data: { displayName, avatarId, selfRoleLabel, allowExplicitMessages },
  });

  revalidatePath(`/playtimes/${slug}`);
  redirect(`/playtimes/${slug}${playerPreview ? "?playerPreview=true" : ""}`);
}
