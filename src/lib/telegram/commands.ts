// Update routing for the Telegram webhook. Kept separate from the route
// handler itself so it's testable without going through a real HTTP
// request, and separate from client.ts/copy.ts/notify.ts so each stays
// focused (transport, voice, push-dispatch, routing).
import { prisma } from "@/lib/prisma";
import { createMagicLinkToken } from "@/lib/baby-auth";
import { loadRules } from "@/lib/rules-content";
import { computeBabyStatus } from "@/lib/baby-status";
import { confirmReportedMatch, disputeMatch, markMatchInProgress } from "@/lib/playtime-lifecycle";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { SELF_ROLE_OPTIONS } from "@/lib/baby-terminology";
import { GAME_DISPLAY } from "@/lib/enum-display";
import * as playerCopy from "@/lib/player-copy";
import { answerCallbackQuery, sendMessage, type InlineKeyboard } from "./client";
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

  if (text === "/profile") {
    await handleProfileCommand(chatId);
    return;
  }

  // Not a command — if there's a pending (nameless) registration for this
  // chat, treat the message as their display name. Only one nameless
  // registration can exist per chat at a time (handleBabyStart won't
  // create a second one across a different playtime while one is still
  // pending — see there), so this lookup is unambiguous even for
  // someone signed up for multiple playtimes.
  const pending = await prisma.baby.findFirst({
    where: { telegramChatId: chatId, displayName: null },
    orderBy: { createdAt: "desc" },
    include: { playtime: true },
  });
  if (pending && text) {
    const updated = await prisma.baby.update({
      where: { id: pending.id },
      data: { displayName: text },
    });
    const link = await magicLink(updated.id);
    await sendMessage(chatId, copy.registeredAndMagicLink(pending.playtime.name, text, link));
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
  const gameLabel = GAME_DISPLAY[playtime.game].label;

  const existing = await prisma.baby.findFirst({ where: { playtimeId: playtime.id, telegramChatId: chatId } });
  if (existing) {
    if (existing.displayName) {
      const link = await magicLink(existing.id);
      await sendMessage(chatId, copy.alreadyRegistered(playtime.name, existing.displayName, link));
    } else {
      await sendMessage(chatId, copy.askForDisplayName(playtime.name, gameLabel));
    }
    return;
  }

  // Only one nameless registration per chat at a time — the plain-text
  // "treat this as your display name" handler above can't tell which
  // pending registration a reply is "for" if there were two, so it'd
  // silently attach the name to whichever is newest. Simplest fix:
  // don't let a second one start until the first is named.
  const otherPending = await prisma.baby.findFirst({
    where: { telegramChatId: chatId, displayName: null, playtimeId: { not: playtime.id } },
  });
  if (otherPending) {
    await sendMessage(chatId, copy.finishOtherRegistrationFirst());
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
  await sendMessage(chatId, copy.askForDisplayName(playtime.name, gameLabel));
}

async function handleStatusCommand(chatId: string): Promise<void> {
  const baby = await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } });
  if (!baby?.displayName) {
    await sendMessage(chatId, "I don't have you checked in yet — use your invite link to join first.");
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

// Entry point for both first-time setup ("during registering") and later
// edits ("afterwards") — the same command either way, per the spec. Kicks
// off a short chained wizard: avatar -> self term -> explicit-messages
// toggle, each step's callback sending the next step's keyboard (see
// handleCallbackQuery below), all optional in the sense that a baby who
// never runs /profile at all just keeps the deployment defaults everywhere.
async function handleProfileCommand(chatId: string): Promise<void> {
  const baby = await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } });
  if (!baby?.displayName) {
    await sendMessage(chatId, copy.notCheckedInYet());
    return;
  }
  await sendMessage(chatId, copy.pickAvatarPrompt(), { replyMarkup: avatarKeyboard() });
}

function avatarKeyboard(): InlineKeyboard {
  return [AVATAR_OPTIONS.map((a) => ({ text: a.label, callback_data: `avatar:${a.id}` }))];
}

// Chunked into rows of 2 — Telegram wraps long single-row keyboards
// awkwardly on narrow phone screens, and both option lists are too long
// for one row to stay tappable.
function chunkedKeyboard(options: readonly string[], prefix: string): InlineKeyboard {
  const buttons = options.map((label, i) => ({ text: label, callback_data: `${prefix}:${i}` }));
  const rows: InlineKeyboard = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return rows;
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

  if (action === "avatar") {
    const baby = chatId ? await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } }) : null;
    if (!baby) {
      await answerCallbackQuery(query.id, "Couldn't find your registration.");
      return;
    }
    const avatar = AVATAR_OPTIONS.find((a) => a.id === id);
    await prisma.baby.update({ where: { id: baby.id }, data: { avatarId: avatar?.id ?? null } });
    await answerCallbackQuery(query.id);
    await sendMessage(chatId!, copy.avatarSetPrompt(avatar?.label ?? id));
    await sendMessage(chatId!, copy.pickSelfRolePrompt(), { replyMarkup: chunkedKeyboard(SELF_ROLE_OPTIONS, "selfrole") });
    return;
  }

  if (action === "selfrole") {
    const baby = chatId ? await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } }) : null;
    if (!baby) {
      await answerCallbackQuery(query.id, "Couldn't find your registration.");
      return;
    }
    const label = SELF_ROLE_OPTIONS[Number(id)];
    await prisma.baby.update({ where: { id: baby.id }, data: { selfRoleLabel: label ?? null } });
    await answerCallbackQuery(query.id);
    if (label) await sendMessage(chatId!, copy.selfRoleSetPrompt(label));
    await sendMessage(chatId!, copy.pickExplicitPrompt(), {
      replyMarkup: [
        [
          { text: "Yes, spicy 🌶️", callback_data: "explicit:1" },
          { text: "No, keep it playful", callback_data: "explicit:0" },
        ],
      ],
    });
    return;
  }

  if (action === "explicit") {
    const baby = chatId ? await prisma.baby.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" } }) : null;
    if (!baby) {
      await answerCallbackQuery(query.id, "Couldn't find your registration.");
      return;
    }
    const allowExplicitMessages = id === "1";
    await prisma.baby.update({ where: { id: baby.id }, data: { allowExplicitMessages } });
    await answerCallbackQuery(query.id);
    await sendMessage(chatId!, copy.explicitSetPrompt(allowExplicitMessages));
    await sendMessage(chatId!, copy.profileSetupComplete());
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
      if (req.baby.telegramChatId) await sendMessage(req.baby.telegramChatId, playerCopy.organizerIsComing(req.baby));
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
