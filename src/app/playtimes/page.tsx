import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePlaytimeButton } from "@/components/admin/CreatePlaytimeButton";
import { GAME_DISPLAY, PLAYTIME_STATUS_DISPLAY } from "@/lib/enum-display";

// Same list, two audiences: an admin sees every playtime (any status)
// plus the create control; anyone else sees only the ones still running
// (COMPLETE is hidden) with no controls at all — this page replaces
// both the old /admin dashboard and doubles as the public "what's on
// right now" index. Delete-all lives in Settings' danger zone, not here.
export default async function PlaytimesListPage() {
  const admin = await getCurrentAdmin();

  const playtimes = await prisma.playtime.findMany({
    where: admin ? undefined : { status: { not: "COMPLETE" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { babies: true } } },
  });

  // Signed-in admins already get a padded, max-w-5xl <main> from the
  // layout — this page's own root only needs to add that itself for
  // the unauthenticated case, where the layout deliberately renders a
  // bare, unpadded full-width wrapper instead (so /playtimes/[slug]'s
  // public spectator screen can go edge-to-edge on a projector). Adding
  // it here rather than in the layout keeps that full-bleed behavior
  // for the spectator screen while still giving this list page real
  // margins.
  return (
    <div className={admin ? "flex flex-col gap-6" : "mx-auto flex max-w-5xl flex-col gap-6 p-6"}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Playtimes</h1>
        {admin && (
          <div className="flex gap-2">
            <CreatePlaytimeButton />
          </div>
        )}
      </header>

      <Card>
        <CardContent>
          {playtimes.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              {admin ? "No playtimes yet — create one above." : "Nothing running right now — check back soon."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {playtimes.map((p) => {
                const game = GAME_DISPLAY[p.game];
                const status = PLAYTIME_STATUS_DISPLAY[p.status];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/playtimes/${p.slugNumber}`}
                      className="flex items-center justify-between gap-3 rounded-card border border-border bg-background px-4 py-3 hover:opacity-90"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        <Badge variant={game.variant}>{game.label}</Badge>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-foreground-muted">{p._count.babies} babies</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
