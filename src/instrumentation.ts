// Next 16 convention: a `register()` export here runs once per new server
// instance, before it starts handling requests (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
// Lives under src/ alongside app/, per that same doc's "inside the src
// folder if using one" rule.
//
// Boot-time webhook check: a stable HTTPS URL only needs registering once
// per environment, but restarts/redeploys are common, so this saves
// remembering to click the admin panel's manual button after every one.
// Gated on all three env vars so local dev / CI / an environment that
// simply hasn't set up Telegram yet stays a silent no-op, matching the
// rest of telegram/client.ts's philosophy.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.NEXT_PUBLIC_APP_URL || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return;
  }

  const { ensureWebhookRegistered } = await import("@/lib/telegram/ensure-webhook");
  const result = await ensureWebhookRegistered();
  if (!result.ok) {
    console.error(`[telegram] boot-time webhook check failed: ${result.message}`);
  }
}
