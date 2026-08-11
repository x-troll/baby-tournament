import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePlaytimeButton } from "@/components/admin/CreatePlaytimeButton";
import { DeleteAllPlaytimesButton } from "@/components/admin/DeleteAllPlaytimesButton";
import { GAME_DISPLAY, PLAYTIME_STATUS_DISPLAY } from "@/lib/enum-display";

export default async function AdminDashboardPage() {
  const playtimes = await prisma.playtime.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { babies: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Playtimes</h1>
        <div className="flex gap-2">
          <DeleteAllPlaytimesButton />
          <CreatePlaytimeButton />
        </div>
      </header>

      <Card>
        <CardContent>
          {playtimes.length === 0 ? (
            <p className="text-sm text-foreground-muted">No playtimes yet — create one above.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {playtimes.map((p) => {
                const game = GAME_DISPLAY[p.game];
                const status = PLAYTIME_STATUS_DISPLAY[p.status];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/playtimes/${p.id}`}
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
