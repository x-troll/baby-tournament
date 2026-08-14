"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortId } from "@/lib/short-id";
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

/**
 * Invalidates this admin's current `/start admin_<token>` link and issues
 * a fresh one — unlike a baby's magic link (10 minutes) or the website
 * join token (checked against the playtime's own status), this token
 * never expired and was reusable indefinitely, so anyone who ever saw it
 * could silently rebind this admin's Telegram notification channel at
 * any time. This is the "Rotatable from the admin panel" the schema
 * comment already promised. Deliberately manual rather than
 * auto-rotate-on-every-use — an admin legitimately re-scans their own QR
 * to relink after switching devices, which auto-rotation would break.
 */
export async function regenerateAdminLinkTokenAction(): Promise<void> {
  const admin = await requireAdmin();
  await prisma.admin.update({ where: { id: admin.id }, data: { adminLinkToken: shortId() } });
  revalidatePath("/admin/settings");
}
