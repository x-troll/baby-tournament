// Update routing for the Telegram webhook. Kept separate from the route
// handler itself so it's testable without going through a real HTTP
// request, and separate from client.ts/copy.ts/notify.ts so each stays
// focused (transport, voice, push-dispatch, routing).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createMagicLinkToken } from "@/lib/baby-auth";
import { loadRules } from "@/lib/rules-content";
import { computeBabyStatus } from "@/lib/baby-status";
import { confirmReportedMatch, disputeMatch, markMatchInProgress } from "@/lib/playtime-lifecycle";
import { acknowledgeHelpRequest, resolveHelpRequest } from "@/lib/help-requests";
import { GAME_DISPLAY } from "@/lib/enum-display";
import * as playerCopy from "@/lib/player-copy";
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

  // Anything else (including a bare "/profile" — registration and
  // profile edits both happen on the web now, see
  // src/app/(baby)/play/[slug]/register/page.tsx and .../settings) is
  // silently ignored — there's nothing left for free-text chat to do.
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

  let baby = await prisma.baby.findFirst({ where: { playtimeId: playtime.id, telegramChatId: chatId } });

  if (baby?.displayName) {
    const link = await magicLink(baby.id);
    await sendMessage(chatId, copy.alreadyRegistered(playtime.name, baby.displayName, link));
    return;
  }

  // No baby yet, or one already exists but hasn't finished registering
  // (a re-tap of the same link) — either way, the same nameless-baby
  // shape and the same next step: a magic link to the web registration
  // page (requireBaby's gate in baby-auth.ts sends any nameless baby
  // there automatically, so this link doesn't need to know that route
  // exists). No more per-playtime "one nameless registration at a time"
  // guard needed — that only ever existed because names used to be
  // collected via ambiguous free-text chat replies, which no longer
  // happens at all.
  if (!baby) {
    const lastBaby = await prisma.baby.findFirst({
      where: { playtimeId: playtime.id },
      orderBy: { registrationOrder: "desc" },
    });
    baby = await prisma.baby.create({
      data: {
        playtimeId: playtime.id,
        telegramChatId: chatId,
        registrationOrder: (lastBaby?.registrationOrder ?? 0) + 1,
      },
    });
  }

  const gameLabel = GAME_DISPLAY[playtime.game].label;
  const link = await magicLink(baby.id);
  await sendMessage(chatId, copy.finishSignupOnWeb(playtime.name, gameLabel, link));
}

async function handleStatusCommand(chatId: string): Promise<void> {
  const baby = await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } });
  if (!baby?.displayName) {
    await sendMessage(chatId, "I don't have you checked in yet, use your invite link to join first.");
    return;
  }
  const state = await computeBabyStatus(baby.id);
  await sendMessage(chatId, copy.statusReply(baby.displayName, playerCopy.describeState(baby, state)));
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
        await answerCallbackQuery(query.id, playerCopy.disputeSentReply(baby));
      }
    } catch (err) {
      await answerCallbackQuery(query.id, err instanceof Error ? err.message : "Something went wrong.");
    }
    return;
  }

  if (action === "start") {
    const baby = chatId ? await prisma.baby.findFirst({ where: { telegramChatId: chatId } }) : null;
    if (!baby) {
      await answerCallbackQuery(query.id, "Couldn't find your registration.");
      return;
    }
    try {
      // markMatchInProgress is itself idempotent (READY -> IN_PROGRESS
      // only, no-ops if already IN_PROGRESS) — safe however many times
      // this gets tapped, from here or the web "We're playing" button.
      await markMatchInProgress(id, baby.id);
      await answerCallbackQuery(query.id, playerCopy.readyCheckReply(baby, baby.displayName ?? "baby"));
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
      await acknowledgeHelpRequest(id);
      revalidatePath("/admin/help-requests");
      await answerCallbackQuery(query.id, copy.adminOnMyWaySent());
    } else {
      const admin = chatId ? await prisma.admin.findFirst({ where: { telegramChatId: chatId } }) : null;
      await resolveHelpRequest(id, admin?.id ?? null);
      revalidatePath("/admin/help-requests");
      await answerCallbackQuery(query.id, "Marked resolved.");
    }
  }
}
