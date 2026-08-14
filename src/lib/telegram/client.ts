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

// No button text currently interpolates unbounded user content (baby
// display names, etc. — see player-copy.ts's header comment on
// readyCheckButtonLabel), but nothing enforced that invariant either.
// These are a last-resort safety net, not the primary fix — the primary
// fix is keeping every button's copy itself short.
const MAX_BUTTON_LABEL_CHARS = 40;
const MAX_CALLBACK_DATA_BYTES = 64; // Telegram's hard limit — it silently rejects anything longer.

function truncateButtonLabel(text: string): string {
  if (text.length <= MAX_BUTTON_LABEL_CHARS) return text;
  return `${text.slice(0, MAX_BUTTON_LABEL_CHARS - 1).trimEnd()}…`;
}

function sanitizeKeyboard(keyboard: InlineKeyboard): InlineKeyboard {
  return keyboard.map((row) =>
    row.map((button) => {
      if ("callback_data" in button) {
        const bytes = new TextEncoder().encode(button.callback_data).length;
        if (bytes > MAX_CALLBACK_DATA_BYTES) {
          console.error(
            `[telegram] callback_data exceeds Telegram's 64-byte limit (${bytes} bytes): ${button.callback_data}`,
          );
        }
      }
      return { ...button, text: truncateButtonLabel(button.text) };
    }),
  );
}

// Retry budget for a 429 (rate limit) — bounded well below any request
// timeout, since this runs inline in a webhook handler / server action,
// not a background worker that can afford to wait out Telegram's own
// `retry_after` in full.
const MAX_RATE_LIMIT_WAIT_MS = 5000;

async function callTelegramApiOnce(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error_code?: number; description?: string; parameters?: { retry_after?: number }; result?: unknown }> {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
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
    const json = await callTelegramApiOnce(token, method, body);

    if (json.ok) return json;

    if (json.error_code === 429) {
      // Rate-limited — Telegram tells us exactly how long to back off.
      // One retry, capped: worth one attempt (bursts like
      // notifyAdminsHelpRequest's fan-out to every linked admin, or
      // notifyMatchStarted's fan-out to every other participant, are the
      // realistic trigger), but not worth blocking the caller
      // indefinitely if Telegram wants longer than that.
      const waitMs = Math.min((json.parameters?.retry_after ?? 1) * 1000, MAX_RATE_LIMIT_WAIT_MS);
      console.error(`[telegram] ${method} rate-limited, retrying after ${waitMs}ms:`, json);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      const retried = await callTelegramApiOnce(token, method, body);
      if (!retried.ok) console.error(`[telegram] ${method} still failing after rate-limit retry:`, retried);
      return retried;
    }

    if (json.error_code === 403) {
      // Bot blocked by this user, or they never started a chat with it —
      // permanent for this chat until they unblock it themselves. Not
      // retryable; logged distinctly so it doesn't read like a transient
      // failure when someone checks the notification log.
      console.error(`[telegram] ${method} blocked (403), recipient has blocked the bot:`, json);
      return json;
    }

    console.error(`[telegram] ${method} failed:`, json);
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
    reply_markup: opts.replyMarkup ? { inline_keyboard: sanitizeKeyboard(opts.replyMarkup) } : undefined,
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
      ? "TELEGRAM_BOT_TOKEN not configured, logged only, nothing actually sent"
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
