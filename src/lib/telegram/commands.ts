// Update routing for the Telegram webhook. Kept separate from the route
// handler itself so it's testable without going through a real HTTP
// request, and separate from client.ts/copy.ts/notify.ts so each stays
// focused (transport, voice, push-dispatch, routing).
import { prisma } from "@/lib/prisma";
import { createMagicLinkToken } from "@/lib/baby-auth";
import { loadRules } from "@/lib/rules-content";
import { computeBabyStatus } from "@/lib/baby-status";
import { confirmReportedMatch, disputeMatch } from "@/lib/playtime-lifecycle";
import { answerCallbackQuery, sendMessage } from "./client";
import * as copy from "./copy";

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: { chat: { id: number }; message_id: number };
}

export interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

async function magicLink(babyId: string): Promise<string> {
  const token = await createMagicLinkToken(babyId);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/nursery/verify?token=${token}`;
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendMessage(chatId, "Scan the QR code at check-in to get your invite link.");
      return;
    }
    if (token.startsWith("admin_")) {
      await handleAdminStart(chatId, token.slice("admin_".length));
    } else {
      await handleBabyStart(chatId, token);
    }
    return;
  }

  if (text === "/status") {
    await handleStatusCommand(chatId);
    return;
  }

  if (text === "/rules") {
    await handleRulesCommand(chatId);
    return;
  }

  // Not a command — if there's a pending (nameless) registration for this
  // chat, treat the message as their display name.
  const pending = await prisma.baby.findFirst({
    where: { telegramChatId: chatId, displayName: null },
    orderBy: { createdAt: "desc" },
  });
  if (pending && text) {
    const updated = await prisma.baby.update({
      where: { id: pending.id },
      data: { displayName: text },
    });
    const link = await magicLink(updated.id);
    await sendMessage(chatId, copy.registeredAndMagicLink(text, link));
  }
}

async function handleAdminStart(chatId: string, adminToken: string): Promise<void> {
  const admin = await prisma.admin.findUnique({ where: { adminLinkToken: adminToken } });
  if (!admin) {
    await sendMessage(chatId, copy.unknownAdminToken());
    return;
  }
  await prisma.admin.update({ where: { id: admin.id }, data: { telegramChatId: chatId } });
  await sendMessage(chatId, copy.adminLinked(admin.name));
}

async function handleBabyStart(chatId: string, joinToken: string): Promise<void> {
  const playtime = await prisma.playtime.findUnique({ where: { joinToken } });
  if (!playtime) {
    await sendMessage(chatId, copy.unknownJoinToken());
    return;
  }

  const existing = await prisma.baby.findFirst({ where: { playtimeId: playtime.id, telegramChatId: chatId } });
  if (existing) {
    if (existing.displayName) {
      const link = await magicLink(existing.id);
      await sendMessage(chatId, copy.alreadyRegistered(existing.displayName, link));
    } else {
      await sendMessage(chatId, copy.askForDisplayName());
    }
    return;
  }

  const lastBaby = await prisma.baby.findFirst({
    where: { playtimeId: playtime.id },
    orderBy: { registrationOrder: "desc" },
  });
  await prisma.baby.create({
    data: {
      playtimeId: playtime.id,
      telegramChatId: chatId,
      registrationOrder: (lastBaby?.registrationOrder ?? 0) + 1,
    },
  });
  await sendMessage(chatId, copy.askForDisplayName());
}

async function handleStatusCommand(chatId: string): Promise<void> {
  const baby = await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } });
  if (!baby?.displayName) {
    await sendMessage(chatId, "I don't have you checked in yet — use your invite link to join first.");
    return;
  }
  const state = await computeBabyStatus(baby.id);
  await sendMessage(chatId, copy.statusReply(baby.displayName, describeState(state)));
}

function describeState(state: Awaited<ReturnType<typeof computeBabyStatus>>): string {
  switch (state.kind) {
    case "DADDY_COMING":
      return "Daddy is on the way to help you.";
    case "CHAMPION":
      return "You're the Best Baby! 🌟";
    case "NAPPED":
      return `Naptime — you finished ${state.placement ?? "?"}.`;
    case "NOT_STARTED":
      return "The playtime hasn't started yet.";
    case "QUIET_TIME":
      return `Quiet time — your turn in about ${state.etaMinutes ?? "a few"} minutes.`;
    case "UP_NEXT":
      return "You're up next! Head over to the console.";
    case "PLAYING":
      return "You're playing now — report your result when you're done.";
    case "WAITING_ON_PLAYMATES":
      return "Waiting on your playmates to confirm your result.";
    case "AWAITING_YOUR_CONFIRMATION":
      return "Someone reported a result — confirm or dispute it on your screen.";
  }
}

async function handleRulesCommand(chatId: string): Promise<void> {
  const baby = await prisma.baby.findFirst({
    where: { telegramChatId: chatId },
    orderBy: { createdAt: "desc" },
    include: { playtime: true },
  });
  if (!baby) {
    await sendMessage(chatId, "Join a playtime first, then I can show you the house rules.");
    return;
  }
  const rules = await loadRules(baby.playtime.game);
  await sendMessage(chatId, copy.rulesReply(rules.summary, baby.playtime.rulesOverrideNote));
}

async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const data = query.data ?? "";
  const chatId = query.message ? String(query.message.chat.id) : null;
  const [action, id] = data.split(":");

  if (!id) {
    await answerCallbackQuery(query.id);
    return;
  }

  if (action === "confirm" || action === "dispute") {
    const baby = chatId ? await prisma.baby.findFirst({ where: { telegramChatId: chatId } }) : null;
    if (!baby) {
      await answerCallbackQuery(query.id, "Couldn't find your registration.");
      return;
    }
    try {
      if (action === "confirm") {
        await confirmReportedMatch(id, { type: "BABY", babyId: baby.id });
        await answerCallbackQuery(query.id, "Confirmed ✅");
      } else {
        await disputeMatch(id, baby.id);
        await answerCallbackQuery(query.id, "Dispute sent — a Daddy will sort it out.");
      }
    } catch (err) {
      await answerCallbackQuery(query.id, err instanceof Error ? err.message : "Something went wrong.");
    }
    return;
  }

  if (action === "help-ack" || action === "help-resolve") {
    const req = await prisma.helpRequest.findUnique({ where: { id }, include: { baby: true } });
    if (!req) {
      await answerCallbackQuery(query.id, "That request is gone.");
      return;
    }
    if (req.status === "RESOLVED") {
      await answerCallbackQuery(query.id, copy.adminAlreadyResolved());
      return;
    }

    if (action === "help-ack") {
      await prisma.helpRequest.update({ where: { id }, data: { status: "ACKNOWLEDGED" } });
      if (req.baby.telegramChatId) await sendMessage(req.baby.telegramChatId, copy.daddyIsComing());
      await answerCallbackQuery(query.id, copy.adminOnMyWaySent());
    } else {
      // Deliberately does *not* touch Match.disputed — that only clears
      // via an actual admin-panel override (confirmMatchResult), which
      // enters a real corrected result. Silently clearing it here would
      // let the original (disputed!) report auto-confirm on its own,
      // the next time anything reads it past its deadline.
      const admin = chatId ? await prisma.admin.findFirst({ where: { telegramChatId: chatId } }) : null;
      await prisma.helpRequest.update({
        where: { id },
        data: { status: "RESOLVED", resolvedById: admin?.id },
      });
      await answerCallbackQuery(query.id, "Marked resolved.");
    }
  }
}
