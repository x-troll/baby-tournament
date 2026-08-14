// Single entry point for creating a new Baby row — every join path
// (website self-join, admin manual add, Telegram /start) used to
// hand-roll an identical, non-atomic
// `findFirst(orderBy: desc) -> create({ registrationOrder: last + 1 })`
// outside any transaction. That both raced under concurrent joins
// (`@@unique([playtimeId, registrationOrder])` throws P2002 for whichever
// request loses the race) and never checked the playtime was still
// accepting registrations — only the website path happened to have its
// own status guard, and even that wasn't atomic with the allocation.
//
// This fixes both: the allocation + status check run inside one
// transaction, and a genuine P2002 collision (two joins landing in the
// same instant) is retried with a fresh read rather than surfacing a raw
// Prisma error to the caller.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Baby } from "@/generated/prisma/client";

const MAX_RETRIES = 5;

export class RegistrationClosedError extends Error {
  constructor() {
    super("Registration's closed, this tournament has already started.");
    this.name = "RegistrationClosedError";
  }
}

export async function createBabyForPlaytime(
  playtimeId: string,
  data: { displayName?: string | null; telegramChatId?: string | null },
): Promise<Baby> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const playtime = await tx.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
        if (playtime.status !== "NURSERY_OPEN") {
          throw new RegistrationClosedError();
        }
        const lastBaby = await tx.baby.findFirst({
          where: { playtimeId },
          orderBy: { registrationOrder: "desc" },
        });
        return tx.baby.create({
          data: {
            playtimeId,
            displayName: data.displayName ?? null,
            telegramChatId: data.telegramChatId ?? null,
            registrationOrder: (lastBaby?.registrationOrder ?? 0) + 1,
          },
        });
      });
    } catch (err) {
      const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isUniqueViolation || attempt === MAX_RETRIES - 1) throw err;
      // Someone else grabbed the same registrationOrder in the same
      // instant — retry with a fresh read now that they've committed.
    }
  }
  throw new Error("createBabyForPlaytime: unreachable");
}
