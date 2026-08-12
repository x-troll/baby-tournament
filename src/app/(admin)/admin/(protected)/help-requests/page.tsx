import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acknowledgeHelpRequestAction, resolveHelpRequestAction } from "@/server-actions/help-requests";

// No baby-facing "request help" button exists yet (that's Phase 5), so
// this inbox has nothing to show until then except whatever gets
// inserted directly for testing — the admin-side viewing/resolving flow
// is real and ready for it.
export default async function HelpRequestsPage() {
  const requests = await prisma.helpRequest.findMany({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    orderBy: { createdAt: "asc" },
    include: { baby: true, match: true },
  });

  return (
    <div className="flex flex-col gap-6">
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
                    {req.baby.displayName ?? "Unnamed baby"}: {req.reason}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {req.note && <p className="text-sm">{req.note}</p>}
                  {req.match && (
                    <p className="text-xs text-foreground-muted">
                      Match: {req.match.kind}, round {req.match.round}
                    </p>
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
