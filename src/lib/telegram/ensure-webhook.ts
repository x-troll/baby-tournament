import { getWebhookInfo, setWebhook } from "./client";

export interface EnsureWebhookResult {
  ok: boolean;
  message: string;
}

/**
 * Core webhook-registration logic, shared by the admin panel's manual
 * "register" button (server-actions/telegram-admin.ts, force: true —
 * always calls setWebhook, so a stale/misconfigured registration can be
 * overwritten on demand) and instrumentation.ts's boot-time check
 * (force: false — first checks what's currently registered and skips
 * the setWebhook call entirely when it already matches, so a normal
 * restart doesn't hit Telegram's API for nothing).
 *
 * No `requireAdmin()`/`revalidatePath` here — those only make sense for
 * the button, not the startup hook.
 */
export async function ensureWebhookRegistered(opts: { force?: boolean } = {}): Promise<EnsureWebhookResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!appUrl || !webhookSecret) {
    return { ok: false, message: "NEXT_PUBLIC_APP_URL and TELEGRAM_WEBHOOK_SECRET must both be set." };
  }

  const targetUrl = `${appUrl}/api/telegram/webhook`;

  if (!opts.force) {
    const currentUrl = await getWebhookInfo();
    if (currentUrl === targetUrl) {
      return { ok: true, message: "Webhook already registered." };
    }
  }

  const ok = await setWebhook(targetUrl, webhookSecret);
  return ok
    ? { ok: true, message: "Webhook registered." }
    : { ok: false, message: "Failed to register — check TELEGRAM_BOT_TOKEN and the server logs." };
}
