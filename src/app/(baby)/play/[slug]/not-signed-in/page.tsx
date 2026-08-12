import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTerminology } from "@/lib/terminology";

// The real entry point is the Telegram magic link — this screen is what
// anyone else hitting /play/<slug> without a session sees, including an
// admin's own "Preview as baby" fallback for babies with no Telegram. No
// baby session exists at this point, so there's nobody's own /profile
// preference to read — this uses the deployment-wide term instead (see
// baby-terminology.ts).
//
// `?otherPlaytime=1` (set by requireBaby in baby-auth.ts) distinguishes
// "no session at all" from "a valid session exists, just for a
// different playtime" — there's only one baby-session cookie site-wide,
// so opening a second game's magic link always swaps out whichever one
// was active. Someone in that second case already has an account here;
// telling them "scan the QR to join" would be actively misleading.
export default async function NotSignedInPage({
  searchParams,
}: {
  searchParams: Promise<{ otherPlaytime?: string }>;
}) {
  const { otherPlaytime } = await searchParams;
  const t = getTerminology();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Not signed in</CardTitle>
        </CardHeader>
        <CardContent>
          {otherPlaytime ? (
            <p className="text-sm text-foreground-muted">
              You&rsquo;re currently checked into a different playtime on this device. Reopen this one from its
              Telegram chat (tap /start again, or your original check-in link) to switch back.
            </p>
          ) : (
            <p className="text-sm text-foreground-muted">
              Scan the QR code at check-in and open it in Telegram to join, or ask a {t.admin} to preview your
              screen from the admin panel.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
