// Notification dispatch — called inline, after a DB transaction commits
// (never from inside one: a Telegram push failing must never roll back a
// confirmed result). Each function takes just an id and fetches whatever
// else it needs, so call sites in playtime-lifecycle.ts / server actions
// stay simple. See PLAN.md for how call sites decide *when* to call these
// (the append-only MatchEvent log doubles as the "what just happened"
// source of truth).
import { prisma } from "@/lib/prisma";
import { loadRules } from "@/lib/rules-content";
import { sendMessage, type InlineKeyboard } from "./client";
import * as copy from "./copy";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}${path}`;
}

async function rulesSummaryFor(playtimeId: string): Promise<string> {
  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { id: playtimeId } });
  const rules = await loadRules(playtime.game);
  return rules.summary;
}

export async function notifyBabyUpNext(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId }, include: { playtime: true } });
  if (!baby?.telegramChatId) return;
  const summary = await rulesSummaryFor(baby.playtimeId);
  await sendMessage(
    baby.telegramChatId,
    copy.upNext(baby.displayName ?? "baby", appUrl(`/play/${baby.playtime.slug}`), summary),
  );
}

export async function notifyMatchReported(matchId: string, reporterBabyId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { participants: { include: { baby: true } }, playtime: true },
  });
  if (!match) return;
  const reporter = match.participants.find((p) => p.babyId === reporterBabyId);
  const summary = await rulesSummaryFor(match.playtimeId);

  const keyboard: InlineKeyboard = [
    [
      { text: "✅ Confirm", callback_data: `confirm:${matchId}` },
      { text: "❌ Dispute", callback_data: `dispute:${matchId}` },
    ],
  ];

  for (const p of match.participants) {
    if (p.babyId === reporterBabyId) continue;
    if (!p.baby.telegramChatId) continue;
    await sendMessage(
      p.baby.telegramChatId,
      copy.needsYourConfirmation(reporter?.baby.displayName ?? "Someone", summary),
      { replyMarkup: keyboard },
    );
  }
}

export async function notifyBabyResultConfirmed(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, copy.resultConfirmed());
}

export async function notifyBabyNapped(babyId: string, placement: number): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, copy.napped(placement));
}

export async function notifyBabyCrowned(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, copy.crowned());
}

export async function notifyBabyDaddyIsComing(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, copy.daddyIsComing());
}

async function matchLabel(matchId: string | null): Promise<string> {
  if (!matchId) return "no active match";
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return "an unknown match";
  return `${match.kind}, round ${match.round}`;
}

export async function notifyAdminsHelpRequest(helpRequestId: string): Promise<void> {
  const req = await prisma.helpRequest.findUnique({
    where: { id: helpRequestId },
    include: { baby: { include: { playtime: true } } },
  });
  if (!req) return;

  const admins = await prisma.admin.findMany({ where: { telegramChatId: { not: null } } });
  if (admins.length === 0) return;

  const label = await matchLabel(req.matchId);
  const deepLink = appUrl(`/admin/playtimes/${req.baby.playtimeId}`);
  const isDispute = req.reason === "score dispute";
  const text = isDispute
    ? copy.adminDisputeAlert(req.baby.displayName ?? "A baby", label, deepLink)
    : copy.adminHelpRequestAlert(req.baby.displayName ?? "A baby", label, req.reason, req.note, deepLink);

  const keyboard: InlineKeyboard = [
    [
      { text: "🏃 On my way", callback_data: `help-ack:${req.id}` },
      { text: "✅ Resolved", callback_data: `help-resolve:${req.id}` },
    ],
  ];

  for (const admin of admins) {
    if (!admin.telegramChatId) continue;
    await sendMessage(admin.telegramChatId, text, { replyMarkup: keyboard });
  }
}
