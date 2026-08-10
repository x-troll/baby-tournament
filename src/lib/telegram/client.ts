// Thin hand-rolled wrapper over the Telegram Bot API — no bot framework.
// This lives inside a single Next.js route handler and needs to fire
// inline from server actions/the lifecycle module, not run its own
// polling loop, so a framework built around "your bot owns the process"
// doesn't fit; a few fetch calls do.
//
// Gracefully no-ops (logs instead of sending) when TELEGRAM_BOT_TOKEN
// isn't set — keeps local dev, the Vitest suite, and the Phase 8
// rehearsal seed script working without a real bot registered.

const API_BASE = "https://api.telegram.org";

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

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
  })) as { ok: boolean; result?: { message_id: number } } | null;
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

export function isTelegramConfigured(): boolean {
  return isConfigured();
}
