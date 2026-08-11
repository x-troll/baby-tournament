"use server";

import { revalidatePath } from "next/cache";
import { requireBaby } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { ORGANIZER_ROLE_OPTIONS, SELF_ROLE_OPTIONS } from "@/lib/baby-terminology";

/** Web counterpart to the Telegram /profile command — same three optional fields, same "empty = use the deployment default" semantics. */
export async function updateBabyProfileAction(slug: string, formData: FormData): Promise<void> {
  const baby = await requireBaby(slug);

  const avatarId = String(formData.get("avatarId") ?? "");
  const organizerRoleLabel = String(formData.get("organizerRoleLabel") ?? "");
  const selfRoleLabel = String(formData.get("selfRoleLabel") ?? "");

  await prisma.baby.update({
    where: { id: baby.id },
    data: {
      avatarId: AVATAR_OPTIONS.some((a) => a.id === avatarId) ? avatarId : null,
      organizerRoleLabel: (ORGANIZER_ROLE_OPTIONS as readonly string[]).includes(organizerRoleLabel)
        ? organizerRoleLabel
        : null,
      selfRoleLabel: (SELF_ROLE_OPTIONS as readonly string[]).includes(selfRoleLabel) ? selfRoleLabel : null,
    },
  });

  revalidatePath(`/play/${slug}`);
  revalidatePath(`/play/${slug}/settings`);
}
