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
import { notifyBabyDaddyIsComing } from "@/lib/telegram/notify";
import type { HelpRequest } from "@/generated/prisma/client";

/** "On my way" — marks ACKNOWLEDGED and pushes "Daddy is coming 💫" to the baby's screen. */
export async function acknowledgeHelpRequest(id: string): Promise<HelpRequest> {
  const req = await prisma.helpRequest.update({ where: { id }, data: { status: "ACKNOWLEDGED" } });
  await notifyBabyDaddyIsComing(req.babyId);
  return req;
}

/**
 * Marks RESOLVED. `adminId` is nullable — the Telegram path resolves it
 * from the acting admin's linked telegramChatId, which can come back
 * empty if that admin never linked Telegram; resolvedById is simply
 * left null rather than blocking the resolve.
 *
 * Deliberately does *not* touch Match.disputed — that only clears via a
 * real admin-panel override (confirmMatchResult) that enters a
 * corrected result. Silently clearing it here would let the original
 * (disputed!) report auto-confirm on its own the next time anything
 * reads it past its deadline.
 */
export async function resolveHelpRequest(id: string, adminId: string | null): Promise<HelpRequest> {
  return prisma.helpRequest.update({
    where: { id },
    data: { status: "RESOLVED", resolvedById: adminId },
  });
}
