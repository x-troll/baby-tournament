import { prisma } from "@/lib/prisma";
import { getTerminology } from "@/lib/terminology";
import { describeMatchKind } from "@/lib/match-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/AutoRefresh";
import { acknowledgeHelpRequestAction, resolveHelpRequestAction } from "@/server-actions/help-requests";

// The one screen explicitly meant to interrupt an admin in real time —
// "Request help from Daddy" is a real, shipped baby-facing button
// (RequestHelpButton.tsx) — used to be the one admin page that never
// refreshed itself: every other "keep watching this" surface polls
// (spectator screen 3s, baby page 5s), this one silently didn't, so a
// newly-opened request wouldn't show until the admin manually navigated
// away and back. AutoRefresh is the same full-page re-render the baby
// page uses — fine here (low-traffic, single authenticated admin, not
// the many-concurrent-viewers spectator screen that needed the cheaper
// event-cursor poll instead).
export default async function HelpRequestsPage() {
  const t = getTerminology();
  const requests = await prisma.helpRequest.findMany({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    orderBy: { createdAt: "asc" },
    include: { baby: true, match: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <h1 className="text-2xl font-bold">Requests</h1>

      {requests.length === 0 ? (
        <p className="text-sm text-foreground-muted">No open help requests. 🎉</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((req) => (
            <li key={req.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {/* req.reason is a stable key (terminology.ts's
                        HelpReasonKey) — raw fallback covers any
                        pre-existing rows created before that change,
                        whose reason column still holds old-style raw
                        text instead of a key. */}
                    {req.baby.displayName ?? "Unnamed baby"}:{" "}
                    {t.helpReasonLabel[req.reason as keyof typeof t.helpReasonLabel] ?? req.reason}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {req.note && <p className="text-sm">{req.note}</p>}
                  {req.match && (
                    <p className="text-xs text-foreground-muted">Match: {describeMatchKind(t, req.match.kind, req.match.round)}</p>
                  )}
                  <p className="text-xs text-foreground-muted">
                    Status: {req.status} · opened {req.createdAt.toLocaleTimeString()}
                  </p>
                  <div className="flex gap-2">
                    {req.status === "OPEN" && (
                      <form action={acknowledgeHelpRequestAction.bind(null, req.id)}>
                        <Button type="submit" size="sm">
                          On my way
                        </Button>
                      </form>
                    )}
                    <form action={resolveHelpRequestAction.bind(null, req.id)}>
                      <Button type="submit" variant="secondary" size="sm">
                        Resolved
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
