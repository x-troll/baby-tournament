import { getTerminology } from "@/lib/terminology";

/**
 * Where /nursery/verify redirects a bad token instead of returning a bare
 * unstyled text response — a baby whose magic link expired mid-event
 * used to land on a plain 400/404 body with no styling and no way back
 * anywhere. Still no real escape hatch to offer (an expired-link baby by
 * definition has no valid session to send them into), but at least this
 * matches the rest of the app instead of reading like a server crash.
 */
export default async function ExpiredLinkPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const t = getTerminology();
  const message =
    reason === "not-found"
      ? `Couldn't find your registration. Ask a ${t.admin} for help.`
      : "This link has expired. Ask the bot for a fresh one with /start.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl">🔗</p>
      <h1 className="text-xl font-bold">Link expired</h1>
      <p className="max-w-sm text-sm text-foreground-muted">{message}</p>
    </main>
  );
}
