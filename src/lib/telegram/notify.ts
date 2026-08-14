// Notification dispatch — called inline, after a DB transaction commits
// (never from inside one: a Telegram push failing must never roll back a
// confirmed result). Each function takes just an id and fetches whatever
// else it needs, so call sites in playtime-lifecycle.ts / server actions
// stay simple. See PLAN.md for how call sites decide *when* to call these
// (the append-only MatchEvent log doubles as the "what just happened"
// source of truth).
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { loadRules } from "@/lib/rules-content";
import { getTerminology } from "@/lib/terminology";
import { describeMatchKind } from "@/lib/match-label";
import * as playerCopy from "@/lib/player-copy";
import { sendMessage, editMessageReplyMarkup, type InlineKeyboard } from "./client";
import * as copy from "./copy";

const t = getTerminology();

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}${path}`;
}

type TrackedMessage = { chatId: string; messageId: number };

function readTrackedMessages(value: unknown): TrackedMessage[] {
  return Array.isArray(value) ? (value as TrackedMessage[]) : [];
}

/**
 * Strips the inline keyboard from every tracked copy of a message —
 * shared by the ready-check ("we're playing?") and help-request
 * ("On my way"/"Resolved") flows, both of which otherwise leave a live,
 * tappable button sitting in Telegram forever once it's no longer
 * actionable. Best-effort: a failed edit (message deleted, chat blocked)
 * is swallowed by editMessageReplyMarkup/callTelegramApi already.
 */
async function clearKeyboards(messages: TrackedMessage[]): Promise<void> {
  for (const { chatId, messageId } of messages) {
    await editMessageReplyMarkup(chatId, messageId, null);
  }
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
  const sent = await sendMessage(baby.telegramChatId, playerCopy.upNext(baby, baby.displayName ?? "baby", summary), {
    replyMarkup: keyboard,
  });
  // Recorded so markMatchInProgress can strip this keyboard once the
  // match actually starts — otherwise the "we're playing?" button stays
  // live and tappable in this chat forever, long after it's stale. Json
  // columns have no atomic "push" in Prisma, so this is a plain
  // read-modify-write; a lost update here (two participants' pushes
  // racing) just means one button doesn't get cleared later, not a
  // correctness issue.
  if (sent) {
    const current = await prisma.match.findUnique({ where: { id: matchId }, select: { readyCheckMessages: true } });
    const existing = readTrackedMessages(current?.readyCheckMessages);
    await prisma.match.update({
      where: { id: matchId },
      data: {
        readyCheckMessages: [
          ...existing,
          { chatId: baby.telegramChatId, messageId: sent.messageId },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

/** Called once a match leaves READY (started, or otherwise resolved) — strips every "we're playing?" button sent for it. See notifyBabyUpNext. */
export async function clearReadyCheckKeyboards(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { readyCheckMessages: true } });
  const messages = readTrackedMessages(match?.readyCheckMessages);
  if (messages.length === 0) return;
  await clearKeyboards(messages);
  await prisma.match.update({ where: { id: matchId }, data: { readyCheckMessages: [] } });
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

/** Shared "look up this baby's chat, no-op if not linked, send plain text" skeleton — the four simplest pushes below only differ in which player-copy text they build. */
async function sendSimpleBabyMessage(
  babyId: string,
  buildText: (baby: playerCopy.CopyBaby) => string,
): Promise<void> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId } });
  if (!baby?.telegramChatId) return;
  await sendMessage(baby.telegramChatId, buildText(baby));
}

export async function notifyBabyResultConfirmed(babyId: string): Promise<void> {
  await sendSimpleBabyMessage(babyId, playerCopy.resultConfirmed);
}

export async function notifyBabyNapped(babyId: string, placement: number): Promise<void> {
  await sendSimpleBabyMessage(babyId, (baby) => playerCopy.napped(baby, placement));
}

export async function notifyBabyCrowned(babyId: string): Promise<void> {
  await sendSimpleBabyMessage(babyId, playerCopy.crowned);
}

export async function notifyBabyDaddyIsComing(babyId: string): Promise<void> {
  await sendSimpleBabyMessage(babyId, playerCopy.organizerIsComing);
}

async function matchLabel(matchId: string | null): Promise<string> {
  if (!matchId) return "no active match";
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return "an unknown match";
  return describeMatchKind(t, match.kind, match.round);
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
  // Case-insensitive — RequestHelpButton.tsx's REASONS sends "Score
  // dispute" (title case), not "score dispute"; a strict-case match here
  // meant this branch never actually fired.
  const isDispute = req.reason.toLowerCase() === "score dispute";
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

  // Fanned out to every linked admin — tracked so acknowledgeHelpRequest/
  // resolveHelpRequest can strip the buttons from *every* admin's copy
  // as soon as any one of them acts, not just answer the tapper's own
  // callback query (see clearKeyboards / clearHelpRequestKeyboards).
  const sentMessages: TrackedMessage[] = [];
  for (const admin of admins) {
    if (!admin.telegramChatId) continue;
    const sent = await sendMessage(admin.telegramChatId, text, { replyMarkup: keyboard });
    if (sent) sentMessages.push({ chatId: admin.telegramChatId, messageId: sent.messageId });
  }
  if (sentMessages.length > 0) {
    await prisma.helpRequest.update({
      where: { id: req.id },
      data: { telegramMessages: sentMessages as unknown as Prisma.InputJsonValue },
    });
  }
}

/** Called once a help request is acknowledged or resolved — strips every admin's "On my way"/"Resolved" buttons for it. See notifyAdminsHelpRequest. */
export async function clearHelpRequestKeyboards(helpRequestId: string): Promise<void> {
  const req = await prisma.helpRequest.findUnique({ where: { id: helpRequestId }, select: { telegramMessages: true } });
  const messages = readTrackedMessages(req?.telegramMessages);
  if (messages.length === 0) return;
  await clearKeyboards(messages);
  await prisma.helpRequest.update({ where: { id: helpRequestId }, data: { telegramMessages: [] } });
}
