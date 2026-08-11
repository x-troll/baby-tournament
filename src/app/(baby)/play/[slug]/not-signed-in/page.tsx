import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTerminology } from "@/lib/terminology";

// The real entry point is the Telegram magic link — this screen is what
// anyone else hitting /play/<slug> without a session sees, including an
// admin's own "Preview as baby" fallback for babies with no Telegram. No
// baby session exists at this point, so there's nobody's own /profile
// preference to read — this uses the deployment-wide term instead (see
// baby-terminology.ts).
export default function NotSignedInPage() {
  const t = getTerminology();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Not signed in</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted">
            Scan the QR code at check-in and open it in Telegram to join — or ask a {t.admin} to preview your screen
            from the admin panel.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
