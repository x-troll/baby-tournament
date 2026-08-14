// Neutral core for help-request acknowledge/resolve — same role as
// playtime-lifecycle.ts for match actions: both the web admin panel
// (server-actions/help-requests.ts) and the Telegram inline-keyboard
// callback (telegram/commands.ts) call these same two functions, so a
// "On my way"/"Resolved" tap behaves identically (DB state, baby
// notification) no matter which surface it came from. No requireAdmin()
// in here — callers resolve and pass the acting admin's id themselves,
// since the Telegram path resolves it from telegramChatId rather than a
// cookie session.
import { prisma } from "@/lib/prisma";
import { notifyBabyDaddyIsComing, clearHelpRequestKeyboards } from "@/lib/telegram/notify";
import type { HelpRequest } from "@/generated/prisma/client";

/** Shared by both admin layouts' nav badge and the Requests page itself — same OPEN/ACKNOWLEDGED filter, one place instead of three independent copies. */
export async function getOpenHelpRequestCount(): Promise<number> {
  return prisma.helpRequest.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } });
}

/**
 * "On my way" — marks ACKNOWLEDGED and pushes "Daddy is coming 💫" to the
 * baby's screen, exactly once. Guarded on `status: "OPEN"` (a conditional
 * update, not read-then-write) so a second ack — another admin tapping
 * their own copy of the same alert, or the same admin double-tapping
 * before the keyboard visibly changes — doesn't re-push the baby a
 * second time. Every admin's copy of the alert also gets its buttons
 * cleared here, not just the tapper's own.
 */
export async function acknowledgeHelpRequest(id: string): Promise<HelpRequest> {
  const { count } = await prisma.helpRequest.updateMany({
    where: { id, status: "OPEN" },
    data: { status: "ACKNOWLEDGED" },
  });
  const req = await prisma.helpRequest.findUniqueOrThrow({ where: { id } });
  if (count > 0) await notifyBabyDaddyIsComing(req.babyId);
  await clearHelpRequestKeyboards(id);
  return req;
}

/**
 * Marks RESOLVED. `adminId` is nullable — the Telegram path resolves it
 * from the acting admin's linked telegramChatId, which can come back
 * empty if that admin never linked Telegram; resolvedById is simply
 * left null rather than blocking the resolve.
 *
 * Doesn't touch the underlying match at all — a "score dispute" reason
 * is a note to the admin to go check the result and correct it via a
 * normal admin override (confirmMatchResult) if needed. Resolving the
 * help-request thread and correcting a bad result are two independent
 * actions.
 */
export async function resolveHelpRequest(id: string, adminId: string | null): Promise<HelpRequest> {
  const req = await prisma.helpRequest.update({
    where: { id },
    data: { status: "RESOLVED", resolvedById: adminId },
  });
  await clearHelpRequestKeyboards(id);
  return req;
}
