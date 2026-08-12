"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ensureWebhookRegistered } from "@/lib/telegram/ensure-webhook";

/**
 * Self-serve webhook registration — a stable HTTPS URL only needs this
 * run once per environment (not per deploy), so a button in the admin
 * panel beats a manual `curl` runbook step. The actual Telegram calls
 * live in ensure-webhook.ts, shared with instrumentation.ts's boot-time
 * check — this action just adds the admin-only auth gate and the
 * revalidate that only make sense for the button, not the startup hook.
 */
export async function registerWebhookAction(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const result = await ensureWebhookRegistered({ force: true });
  revalidatePath("/admin/settings");
  return result;
}
