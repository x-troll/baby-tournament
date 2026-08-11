import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { adminLinkDeepLink, qrCodeDataUri } from "@/lib/qr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterWebhookButton } from "@/components/admin/RegisterWebhookButton";

// The deep link + bot are both live now (Phase 6) — /start admin_<token>
// on the bot links this Daddy's Telegram account to receive pushes.
export default async function AdminProfilePage() {
  const admin = await requireAdmin();
  const hasBotUsername = Boolean(process.env.TELEGRAM_BOT_USERNAME);
  const deepLink = hasBotUsername ? adminLinkDeepLink(admin.adminLinkToken) : null;
  const qr = deepLink ? await qrCodeDataUri(deepLink) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">My profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>{admin.name}</CardTitle>
          <CardDescription>{admin.username}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">Telegram: {admin.telegramChatId ? "linked ✓" : "not linked yet"}</p>

          {!hasBotUsername && (
            <p className="text-sm text-foreground-muted">
              Set TELEGRAM_BOT_USERNAME to show your personal linking QR code.
            </p>
          )}

          {deepLink && qr && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-foreground-muted">
                Scan with Telegram, or open this link, to receive help-request/dispute/round pushes on this device:
              </p>
              <Image src={qr} alt="Telegram admin-link QR code" width={220} height={220} unoptimized />
              <code className="break-all text-xs text-foreground-muted">{deepLink}</code>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot setup</CardTitle>
          <CardDescription>Run once per environment — not per deploy, the URL is stable.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterWebhookButton />
        </CardContent>
      </Card>
    </div>
  );
}
