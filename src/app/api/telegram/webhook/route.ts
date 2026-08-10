import { NextRequest, NextResponse } from "next/server";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/commands";

/**
 * Webhook, not polling — Heroku gives a stable HTTPS URL (per spec).
 * Verified with the secret token Telegram echoes back on every request
 * once registered via setWebhook (see the admin panel's "register
 * webhook" button, which sets it).
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    // Telegram retries on non-2xx — log and still return 200 so a bug in
    // one update's handling doesn't get retried indefinitely.
    console.error("[telegram webhook] handler error:", err);
  }

  return NextResponse.json({ ok: true });
}
