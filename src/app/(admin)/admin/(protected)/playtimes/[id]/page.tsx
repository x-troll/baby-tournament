import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { babyJoinDeepLink, qrCodeDataUri } from "@/lib/qr";
import { getTerminology } from "@/lib/terminology";
import { buildPlaypenSection } from "@/lib/playpen-view";
import { buildPhase2Bracket } from "@/lib/bracket-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import {
  addBabyManuallyAction,
  openNurseryAction,
  removeBabyAction,
  startPlaytimeAction,
} from "@/server-actions/playtimes";
import { reportMatchResultFormAction, undoMatchResultAction } from "@/server-actions/matches";
import { previewAsBabyAction } from "@/server-actions/baby-auth";

export default async function PlaytimeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const playtime = await prisma.playtime.findUniqueOrThrow({
    where: { id },
    include: {
      babies: { orderBy: { registrationOrder: "asc" } },
      matches: {
        include: { participants: { include: { baby: true } } },
        orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  const hasBotUsername = Boolean(process.env.TELEGRAM_BOT_USERNAME);
  const joinLink = hasBotUsername ? babyJoinDeepLink(playtime.joinToken) : null;
  const qr = joinLink ? await qrCodeDataUri(joinLink) : null;

  const activeCount = playtime.babies.filter((b) => b.status === "ACTIVE").length;
  const t = getTerminology();

  // Once the playtime is finished every baby has a finalPlacement — show
  // the star chart in that order (1st, 2nd, 3rd, ...) instead of
  // registration order. While still in progress most babies don't have
  // one yet, so registration order (the fetch's default) stays clearest.
  const starChartBabies =
    playtime.status === "COMPLETE"
      ? [...playtime.babies].sort((a, b) => (a.finalPlacement ?? 999) - (b.finalPlacement ?? 999))
      : playtime.babies;

  const toParticipant = (p: {
    babyId: string;
    finishPosition: number | null;
    seedInMatch: number | null;
    baby: { displayName: string | null };
  }) => ({
    babyId: p.babyId,
    name: p.baby.displayName ?? "Unnamed baby",
    finishPosition: p.finishPosition,
    seedInMatch: p.seedInMatch,
  });

  const playpens = buildPlaypenSection(
    playtime.matches.map((m) => ({
      id: m.id,
      kind: m.kind,
      round: m.round,
      penIndex: m.penIndex,
      status: m.status,
      participants: m.participants.map(toParticipant),
    })),
    t.groupStageHeat,
    t.groupStageHeatPlural,
  );

  const phase2Bracket = buildPhase2Bracket(
    playtime.matches.map((m) => ({
      kind: m.kind,
      status: m.status,
      participants: m.participants.map(toParticipant),
    })),
  );

  // Three tabs instead of three stacked cards — same content as before,
  // just switchable instead of one long scroll. "Matches" (where the
  // admin actually takes action — reporting/undoing results) defaults
  // active, since that's what running the event mostly means.
  const detailTabs: TabItem[] = [
    {
      id: "star-chart",
      label: "Star chart",
      content: (
        <>
          <table className="w-full text-sm">
            <caption className="sr-only">Baby standings for {playtime.name}</caption>
            <thead>
              <tr className="border-b border-border text-left text-foreground-muted">
                <th scope="col" className="py-1 pr-2">
                  Baby
                </th>
                <th scope="col" className="py-1 pr-2">
                  Status
                </th>
                <th scope="col" className="py-1 pr-2">
                  Seed
                </th>
                <th scope="col" className="py-1 pr-2">
                  Placement
                </th>
                <th scope="col" className="py-1">
                  <span className="sr-only">Preview</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {starChartBabies.map((baby) => (
                <tr key={baby.id} className="border-b border-border last:border-0">
                  <td className="py-1 pr-2">{baby.displayName ?? "(no name)"}</td>
                  <td className="py-1 pr-2">
                    {baby.status === "CHAMPION" ? "🌟 Best Baby" : baby.status === "NAPPED" ? "Napping" : "Active"}
                  </td>
                  <td className="py-1 pr-2">{baby.seed ?? "—"}</td>
                  <td className="py-1 pr-2">{baby.finalPlacement ?? "—"}</td>
                  <td className="py-1">
                    <form action={previewAsBabyAction.bind(null, baby.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Preview
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-foreground-muted">{activeCount} baby(ies) still active.</p>
        </>
      ),
    },
    {
      id: "playpens",
      label: t.groupStageHeatPlural.charAt(0).toUpperCase() + t.groupStageHeatPlural.slice(1),
      content:
        playpens || phase2Bracket ? (
          <PlaytimeBracketsView playpens={playpens} phase2Bracket={phase2Bracket} />
        ) : (
          <p className="text-sm text-foreground-muted">Nothing to show yet.</p>
        ),
    },
    {
      id: "matches",
      label: "Matches",
      content:
        playtime.matches.length === 0 ? (
          <p className="text-sm text-foreground-muted">No matches yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {playtime.matches.map((match) => (
              <div key={match.id} className="rounded-card border border-border bg-background p-3">
                <p className="text-sm font-semibold">
                  {match.kind} · round {match.round}
                  {match.penIndex != null ? ` · pen ${match.penIndex + 1}` : ""} · {match.status}
                  {match.stationNumber != null ? ` · station ${match.stationNumber}` : ""}
                </p>
                <ul className="mt-1 text-sm">
                  {match.participants
                    .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
                    .map((p) => (
                      <li key={p.id}>
                        {p.finishPosition ? `${p.finishPosition}. ` : ""}
                        {p.baby.displayName ?? "(no name)"}
                        {p.seedInMatch ? ` (seed ${p.seedInMatch})` : ""}
                      </li>
                    ))}
                </ul>

                {match.status !== "CONFIRMED" ? (
                  <form
                    action={reportMatchResultFormAction.bind(
                      null,
                      playtime.id,
                      match.id,
                      match.participants.map((p) => p.babyId),
                    )}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    {match.participants.map((p) => (
                      <label key={p.id} className="flex flex-col gap-1 text-xs">
                        {p.baby.displayName ?? "(no name)"}
                        <select
                          name={`position-${p.babyId}`}
                          defaultValue=""
                          required
                          className="min-h-11 rounded-card border border-border bg-background-elevated px-2 py-1 text-sm"
                        >
                          <option value="" disabled>
                            Place
                          </option>
                          {match.participants.map((_, i) => (
                            <option key={i} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <Button type="submit" size="sm">
                      Report result (admin override)
                    </Button>
                  </form>
                ) : (
                  <form action={undoMatchResultAction.bind(null, playtime.id, match.id)} className="mt-2">
                    <Button type="submit" variant="secondary" size="sm">
                      Undo last result
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{playtime.name}</h1>
          <p className="text-sm text-foreground-muted">
            {playtime.game} · {playtime.status} · {playtime.stationCount} station
            {playtime.stationCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={`/live/${playtime.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", className: "shrink-0" })}
        >
          Open as spectator
        </Link>
      </header>

      {(playtime.status === "DRAFT" || playtime.status === "NURSERY_OPEN") && (
        <Card>
          <CardHeader>
            <CardTitle>The nursery (check-in)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {joinLink && qr ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-foreground-muted">Babies scan this to join via Telegram:</p>
                <Image src={qr} alt="Join QR code" width={200} height={200} unoptimized />
                <code className="break-all text-xs text-foreground-muted">{joinLink}</code>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                Set TELEGRAM_BOT_USERNAME to show the join QR (bot itself lands in Phase 6).
              </p>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Registered babies ({playtime.babies.length})
              </h3>
              {playtime.babies.length === 0 ? (
                <p className="text-sm text-foreground-muted">Nobody yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {playtime.babies.map((baby) => (
                    <li
                      key={baby.id}
                      className="flex items-center justify-between rounded-card border border-border bg-background px-3 py-2 text-sm"
                    >
                      <span>
                        {baby.registrationOrder}. {baby.displayName ?? "(no name yet)"}
                        {!baby.telegramChatId && (
                          <span className="ml-2 text-xs text-foreground-muted">no Telegram</span>
                        )}
                      </span>
                      <span className="flex gap-2">
                        <form action={previewAsBabyAction.bind(null, baby.id)}>
                          <Button type="submit" variant="secondary" size="sm">
                            Preview
                          </Button>
                        </form>
                        <form action={removeBabyAction.bind(null, playtime.id, baby.id)}>
                          <Button type="submit" variant="ghost" size="sm">
                            Remove
                          </Button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form action={addBabyManuallyAction.bind(null, playtime.id)} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="displayName" className="text-sm font-semibold">
                  Add a baby manually (no Telegram)
                </label>
                <Input id="displayName" name="displayName" placeholder="Display name" required />
              </div>
              <Button type="submit">Add</Button>
            </form>

            <div className="flex gap-2">
              {playtime.status === "DRAFT" && (
                <form action={openNurseryAction.bind(null, playtime.id)}>
                  <Button type="submit">Open the nursery</Button>
                </form>
              )}
              {playtime.status === "NURSERY_OPEN" && (
                <form action={startPlaytimeAction.bind(null, playtime.id)}>
                  <Button type="submit" disabled={playtime.babies.length < 3}>
                    Start playtime ({playtime.babies.length}/3 minimum)
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(playtime.status === "IN_PROGRESS" || playtime.status === "COMPLETE") && (
        <Card>
          <Tabs label="Playtime details" items={detailTabs} defaultTabId="matches" />
        </Card>
      )}
    </div>
  );
}
