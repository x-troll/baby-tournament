import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { GAME_DISPLAY } from "@/lib/enum-display";
import { joinViaWebsiteAction } from "@/server-actions/baby-join";

// The website counterpart to Telegram's `t.me/<bot>?start=<joinToken>`
// deep link — same joinToken, same capability-secret model (no slug
// needed in the URL, the token alone identifies the playtime), just a
// real page instead of a chat. Public: nobody's signed in yet, that's
// the whole point of this route.
//
// Deliberately a thin "confirm & join" step, not a registration form —
// name/avatar/role collection lives on the one shared
// /play/[slug]/register page both this and Telegram's magic link funnel
// into (via requireBaby's gate in baby-auth.ts), so there's exactly one
// registration form to maintain instead of two.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const playtime = await prisma.playtime.findUnique({ where: { joinToken: token } });

  if (!playtime) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-muted">
              This invite link isn&rsquo;t valid — ask for a fresh QR code.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (playtime.status !== "NURSERY_OPEN") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>Registration&rsquo;s closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-muted">
              {playtime.name} has already started — check with whoever&rsquo;s running it.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const gameLabel = GAME_DISPLAY[playtime.game].label;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Join {playtime.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-foreground-muted">
            Signing up here (instead of via Telegram) means no notifications — you won&rsquo;t get a heads-up before
            or when it&rsquo;s your turn for {gameLabel}. You&rsquo;ll need to keep this page open and check it
            yourself. Next step: pick your name and a picture.
          </p>
          <form action={joinViaWebsiteAction.bind(null, token)}>
            <Button type="submit" className="w-full">
              Join without Telegram
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
