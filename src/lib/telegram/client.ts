// Thin hand-rolled wrapper over the Telegram Bot API — no bot framework.
// This lives inside a single Next.js route handler and needs to fire
// inline from server actions/the lifecycle module, not run its own
// polling loop, so a framework built around "your bot owns the process"
// doesn't fit; a few fetch calls do.
//
// Gracefully no-ops (logs instead of sending) when TELEGRAM_BOT_TOKEN
// isn't set — keeps local dev, the Vitest suite, and the Phase 8
// rehearsal seed script working without a real bot registered.

import { logNotification } from "@/lib/notification-log";

const API_BASE = "https://api.telegram.org";

// Either a callback button (round-trips through the webhook as a
// callback_query) or a URL button (opens a link directly, no round-trip)
// — never both on the same button, matching Telegram's own API shape.
export type InlineKeyboardButton = { text: string } & ({ callback_data: string } | { url: string });

export type InlineKeyboard = InlineKeyboardButton[][];

function isConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function callTelegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[telegram:noop] ${method}`, JSON.stringify(body));
    return null;
  }

  // Never throw — a baby not getting a Telegram message (network blip,
  // API error, whatever) must never break the caller's main flow, which
  // by construction always calls this *after* the DB transaction that
  // actually matters has already committed.
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`[telegram] ${method} failed:`, json);
    }
    return json;
  } catch (err) {
    console.error(`[telegram] ${method} threw:`, err);
    return null;
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  opts: { replyMarkup?: InlineKeyboard; parseMode?: "Markdown" } = {},
): Promise<{ messageId: number } | null> {
  const result = (await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: opts.parseMode,
    reply_markup: opts.replyMarkup ? { inline_keyboard: opts.replyMarkup } : undefined,
  })) as { ok: boolean; description?: string; result?: { message_id: number } } | null;

  // Logged here, not inside callTelegramApi — sendMessage is the one
  // function every notification path (notify.ts's pushes, the help-ack/
  // resolve core, admin-link/join-flow copy) funnels through, so this is
  // the single point that captures all of them without also logging the
  // lower-level keyboard-editing/webhook-management calls nobody needs
  // to audit here.
  logNotification({
    chatId,
    text,
    success: Boolean(result?.result),
    error: !isConfigured()
      ? "TELEGRAM_BOT_TOKEN not configured — logged only, nothing actually sent"
      : !result?.result
        ? (result?.description ?? "Unknown error")
        : undefined,
  });

  return result?.result ? { messageId: result.result.message_id } : null;
}

export async function sendPhoto(chatId: string, photoUrl: string, caption?: string): Promise<void> {
  await callTelegramApi("sendPhoto", { chat_id: chatId, photo: photoUrl, caption });
}

export async function editMessageReplyMarkup(
  chatId: string,
  messageId: number,
  replyMarkup: InlineKeyboard | null,
): Promise<void> {
  await callTelegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup ? { inline_keyboard: replyMarkup } : undefined,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function setWebhook(url: string, secretToken: string): Promise<boolean> {
  if (!isConfigured()) return false;
  const result = (await callTelegramApi("setWebhook", { url, secret_token: secretToken })) as { ok: boolean } | null;
  return result?.ok ?? false;
}

export async function deleteWebhook(): Promise<boolean> {
  if (!isConfigured()) return false;
  const result = (await callTelegramApi("deleteWebhook", {})) as { ok: boolean } | null;
  return result?.ok ?? false;
}

/** Currently-registered webhook URL, or null if unconfigured/unregistered/errored. */
export async function getWebhookInfo(): Promise<string | null> {
  if (!isConfigured()) return null;
  const result = (await callTelegramApi("getWebhookInfo", {})) as {
    ok: boolean;
    result?: { url?: string };
  } | null;
  return result?.ok ? (result.result?.url ?? null) : null;
}

export function isTelegramConfigured(): boolean {
  return isConfigured();
}
