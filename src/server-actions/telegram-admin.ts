"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { setWebhook } from "@/lib/telegram/client";

/**
 * Self-serve webhook registration — a stable HTTPS URL only needs this
 * run once per environment (not per deploy), so a button in the admin
 * panel beats a manual `curl` runbook step.
 */
export async function registerWebhookAction(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!appUrl || !webhookSecret) {
    return { ok: false, message: "NEXT_PUBLIC_APP_URL and TELEGRAM_WEBHOOK_SECRET must both be set." };
  }

  const ok = await setWebhook(`${appUrl}/api/telegram/webhook`, webhookSecret);
  revalidatePath("/admin/profile");
  return ok
    ? { ok: true, message: "Webhook registered." }
    : { ok: false, message: "Failed to register — check TELEGRAM_BOT_TOKEN and the server logs." };
}
