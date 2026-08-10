"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startPlaytime as startPlaytimeLifecycle } from "@/lib/playtime-lifecycle";
import { Game } from "@/generated/prisma/enums";

const DEFAULT_MATCH_DURATION_SEC: Record<Game, number> = {
  [Game.MARIO_KART]: 8 * 60,
  [Game.SUPER_SMASH]: 6 * 60,
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = randomUUID().slice(0, 6);
  return `${base || "playtime"}-${suffix}`;
}

export async function createPlaytimeAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const gameRaw = String(formData.get("game") ?? "");
  const stationCount = Number(formData.get("stationCount") ?? 1);
  const rulesOverrideNote = String(formData.get("rulesOverrideNote") ?? "").trim();

  if (!name) throw new Error("Playtime name is required.");
  if (!Object.values(Game).includes(gameRaw as Game)) throw new Error("Invalid game.");
  const game = gameRaw as Game;
  if (!Number.isInteger(stationCount) || stationCount < 1) {
    throw new Error("Station count must be a positive integer.");
  }

  const playtime = await prisma.playtime.create({
    data: {
      name,
      game,
      slug: slugify(name),
      stationCount,
      defaultMatchDurationSec: DEFAULT_MATCH_DURATION_SEC[game],
      rulesOverrideNote: rulesOverrideNote || null,
    },
  });

  revalidatePath("/admin");
  redirect(`/admin/playtimes/${playtime.id}`);
}

export async function addBabyManuallyAction(playtimeId: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new Error("Display name is required.");

  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
  if (playtime.status !== "DRAFT" && playtime.status !== "NURSERY_OPEN") {
    throw new Error("Can't add babies once the playtime has started.");
  }

  const lastBaby = await prisma.baby.findFirst({
    where: { playtimeId },
    orderBy: { registrationOrder: "desc" },
  });

  await prisma.baby.create({
    data: {
      playtimeId,
      displayName,
      registrationOrder: (lastBaby?.registrationOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/admin/playtimes/${playtimeId}`);
}

export async function removeBabyAction(playtimeId: string, babyId: string): Promise<void> {
  await requireAdmin();

  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
  if (playtime.status !== "DRAFT" && playtime.status !== "NURSERY_OPEN") {
    throw new Error("Can't remove babies once the playtime has started — that's a forfeit, not a removal.");
  }

  await prisma.baby.delete({ where: { id: babyId } });
  revalidatePath(`/admin/playtimes/${playtimeId}`);
}

export async function openNurseryAction(playtimeId: string): Promise<void> {
  await requireAdmin();
  await prisma.playtime.update({
    where: { id: playtimeId, status: "DRAFT" },
    data: { status: "NURSERY_OPEN" },
  });
  revalidatePath(`/admin/playtimes/${playtimeId}`);
}

export async function startPlaytimeAction(playtimeId: string): Promise<void> {
  await requireAdmin();
  await startPlaytimeLifecycle(playtimeId);
  revalidatePath(`/admin/playtimes/${playtimeId}`);
}
