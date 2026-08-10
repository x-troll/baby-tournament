import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPlaytimeAction } from "@/server-actions/playtimes";
import { Game } from "@/generated/prisma/enums";

export default async function AdminDashboardPage() {
  const playtimes = await prisma.playtime.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { babies: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Playtimes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Existing playtimes</CardTitle>
        </CardHeader>
        <CardContent>
          {playtimes.length === 0 ? (
            <p className="text-sm text-foreground-muted">No playtimes yet — create one below.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {playtimes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/playtimes/${p.id}`}
                    className="flex items-center justify-between rounded-card border border-border bg-background px-4 py-3 hover:opacity-90"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-sm text-foreground-muted">
                      {p.game} · {p.status} · {p._count.babies} babies
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a playtime</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPlaytimeAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-sm font-semibold">
                Name
              </label>
              <Input id="name" name="name" required placeholder="Friday Night Playtime" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Game</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="game" value={Game.MARIO_KART} defaultChecked required />
                  Mario Kart
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="game" value={Game.SUPER_SMASH} />
                  Super Smash Bros
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="stationCount" className="text-sm font-semibold">
                Stations
              </label>
              <Input id="stationCount" name="stationCount" type="number" min={1} defaultValue={1} className="w-24" />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="rulesOverrideNote" className="text-sm font-semibold">
                Tonight-only rules note <span className="font-normal text-foreground-muted">(optional)</span>
              </label>
              <Input id="rulesOverrideNote" name="rulesOverrideNote" placeholder="e.g. 3 races per match tonight" />
            </div>

            <Button type="submit" className="mt-2 self-start">
              Create playtime
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
