import { requireAdmin } from "@/lib/auth";
import { adminLinkDeepLink } from "@/lib/qr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterWebhookButton } from "@/components/admin/RegisterWebhookButton";
import { RegenerateAdminLinkButton } from "@/components/admin/RegenerateAdminLinkButton";
import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { DeleteAllPlaytimesButton } from "@/components/admin/DeleteAllPlaytimesButton";
import { NukeDatabaseButton } from "@/components/admin/NukeDatabaseButton";

// The deep link + bot are both live now (Phase 6) — /start admin_<token>
// on the bot links this Daddy's Telegram account to receive pushes.
export default async function AdminProfilePage() {
  const admin = await requireAdmin();
  const hasBotUsername = Boolean(process.env.TELEGRAM_BOT_USERNAME);
  const deepLink = hasBotUsername ? adminLinkDeepLink(admin.adminLinkToken) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>

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

          {deepLink && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-foreground-muted">
                Scan with Telegram, or open this link, to receive help-request/dispute/round pushes on this device:
              </p>
              <StyledQrCode data={deepLink} size={440} />
              <code className="break-all text-xs text-foreground-muted">{deepLink}</code>
              <RegenerateAdminLinkButton />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot setup</CardTitle>
          <CardDescription>Run once per environment, not per deploy, the URL is stable.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterWebhookButton />
        </CardContent>
      </Card>

      <Card className="border-danger">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Destructive, confirmed before anything happens, there&rsquo;s no undo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <DeleteAllPlaytimesButton />
          <NukeDatabaseButton />
        </CardContent>
      </Card>
    </div>
  );
}
