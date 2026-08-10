import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The real entry point (Telegram magic link) is Phase 6. Until then, a
// Daddy can generate a session via "Preview as baby" on the playtime's
// admin page — this screen is what anyone else hitting /play/<slug>
// without a session sees.
export default function NotSignedInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Not signed in</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted">
            Scan the QR code at check-in and open it in Telegram to join — or ask a Daddy to preview your screen from
            the admin panel.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
