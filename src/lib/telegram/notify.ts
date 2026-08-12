// Notification dispatch — called inline, after a DB transaction commits
// (never from inside one: a Telegram push failing must never roll back a
// confirmed result). Each function takes just an id and fetches whatever
// else it needs, so call sites in playtime-lifecycle.ts / server actions
// stay simple. See PLAN.md for how call sites decide *when* to call these
// (the append-only MatchEvent log doubles as the "what just happened"
// source of truth).
import { prisma } from "@/lib/prisma";
import { loadRules } from "@/lib/rules-content";
import * as playerCopy from "@/lib/player-copy";
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

// Label shared by both this and notifyBabyUpSoon below — same "your
// dashboard" screen either way, per spec ("a link to the same dashboard
// as above, but worded as 'Update playtime status: ...'").
const DASHBOARD_BUTTON_LABEL = "📲 Update playtime status";

export async function notifyBabyUpNext(babyId: string, matchId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId }, include: { playtime: true } });
  if (!baby?.telegramChatId) return;
  const summary = await rulesSummaryFor(baby.playtimeId);
  const keyboard: InlineKeyboard = [
    [{ text: DASHBOARD_BUTTON_LABEL, url: appUrl(`/play/${baby.playtime.slugNumber}`) }],
    [{ text: playerCopy.readyCheckButtonLabel(baby), callback_data: `start:${matchId}` }],
  ];
  await sendMessage(baby.telegramChatId, playerCopy.upNext(baby, baby.displayName ?? "baby", summary), {
    replyMarkup: keyboard,
  });
}

/**
 * The genuine second message per match, ahead of notifyBabyUpNext's real
 * "you're up" push — fired once (see scheduleReadyMatches's
 * upSoonNotifiedAt guard) as soon as a baby's match becomes the immediate
 * next in line. ETA uses the playtime's static configured
 * defaultMatchDurationSec — there's no real rolling average tracked
 * anywhere in this codebase despite the schema field's name/comment
 * suggesting otherwise (see PLAN.md); this is exactly as accurate as that
 * one number already is.
 */
export async function notifyBabyUpSoon(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId }, include: { playtime: true } });
  if (!baby?.telegramChatId) return;
  const etaMinutes = Math.max(1, Math.round(baby.playtime.defaultMatchDurationSec / 60));
  const keyboard: InlineKeyboard = [[{ text: DASHBOARD_BUTTON_LABEL, url: appUrl(`/play/${baby.playtime.slugNumber}`) }]];
  await sendMessage(baby.telegramChatId, playerCopy.upSoon(baby, baby.displayName ?? "baby", etaMinutes), {
    replyMarkup: keyboard,
  });
}

/**
 * Fired once a match flips READY -> IN_PROGRESS (see
 * `markMatchInProgress`) — every other transition already has a push,
 * this was the one gap. Goes to every *other* participant with
 * Telegram linked — not whoever actually tapped "we're playing"
 * (`actingBabyId`): they already got Telegram's own instant reply for
 * that tap (`readyCheckReply`, an `answerCallbackQuery` toast) or, if
 * they started it from the web instead, they're already looking at the
 * PLAYING state — sending them this too would land right on top of
 * their own still-visible "we're ready" button and read as two prompts
 * for the same moment. Everyone else on the match still gets this as
 * genuine news (someone else just started it) plus the same "submit
 * your result when you're done" link back to the dashboard.
 */
export async function notifyMatchStarted(matchId: string, actingBabyId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { participants: { include: { baby: true } }, playtime: true },
  });
  if (!match) return;
  const keyboard: InlineKeyboard = [[{ text: DASHBOARD_BUTTON_LABEL, url: appUrl(`/play/${match.playtime.slugNumber}`) }]];

  for (const p of match.participants) {
    if (p.babyId === actingBabyId) continue;
    if (!p.baby.telegramChatId) continue;
    await sendMessage(p.baby.telegramChatId, playerCopy.matchStarted(p.baby, p.baby.displayName ?? "baby"), {
      replyMarkup: keyboard,
    });
  }
}

export async function notifyBabyResultConfirmed(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, playerCopy.resultConfirmed(baby));
}

export async function notifyBabyNapped(babyId: string, placement: number): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, playerCopy.napped(baby, placement));
}

export async function notifyBabyCrowned(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, playerCopy.crowned(baby));
}

export async function notifyBabyDaddyIsComing(babyId: string): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, playerCopy.organizerIsComing(baby));
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
  const deepLink = appUrl(`/playtimes/${req.baby.playtime.slugNumber}`);
  const isDispute = req.reason === "score dispute";
  const text = isDispute
    ? copy.adminDisputeAlert(req.baby.displayName ?? "A baby", label)
    : copy.adminHelpRequestAlert(req.baby.displayName ?? "A baby", label, req.reason, req.note);

  const keyboard: InlineKeyboard = [
    [
      { text: "🏃 On my way", callback_data: `help-ack:${req.id}` },
      { text: "✅ Resolved", callback_data: `help-resolve:${req.id}` },
    ],
    [{ text: "📋 Open in admin panel", url: deepLink }],
  ];

  for (const admin of admins) {
    if (!admin.telegramChatId) continue;
    await sendMessage(admin.telegramChatId, text, { replyMarkup: keyboard });
  }
}
