import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { parseSlugNumber } from "@/lib/slug-number";
import { computeSpectatorState } from "@/lib/spectator-state";
import { loadRules } from "@/lib/rules-content";
import { babyJoinDeepLink, websiteJoinLink } from "@/lib/qr";
import { getTerminology } from "@/lib/terminology";
import { resolveAvatarSrc } from "@/lib/avatars";
import { buildPlaypenSection } from "@/lib/playpen-view";
import { buildPhase2Bracket } from "@/lib/bracket-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import { AddBabyManuallyButton } from "@/components/admin/AddBabyManuallyButton";
import { StartPlaytimeButton } from "@/components/admin/StartPlaytimeButton";
import { SpectatorPoller } from "@/components/spectator/SpectatorPoller";
import { NurseryCheckIn } from "@/components/spectator/NurseryCheckIn";
import { PLAYTIME_STATUS_DISPLAY } from "@/lib/enum-display";
import { removeBabyAction } from "@/server-actions/playtimes";
import { reportMatchResultFormAction, undoMatchResultAction } from "@/server-actions/matches";
import { previewAsBabyAction } from "@/server-actions/baby-auth";

/**
 * Replaces both the old /live/[slug] (public spectator screen) and
 * /admin/playtimes/[id] (admin control panel) — one URL, keyed on the
 * public-facing slugNumber (not the cuid the admin route used to use),
 * branching on whether the visitor is a signed-in admin.
 */
export default async function PlaytimeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugNumber = parseSlugNumber(slug);
  if (slugNumber === null) notFound();

  const admin = await getCurrentAdmin();

  if (!admin) {
    const playtime = await prisma.playtime.findUnique({ where: { slugNumber } });
    if (!playtime) notFound();

    const [state, rules] = await Promise.all([computeSpectatorState(slug), loadRules(playtime.game)]);
    if (!state) notFound();

    return (
      <main className="min-h-screen pb-8">
        <SpectatorPoller
          slug={slug}
          initial={state}
          backHref="/playtimes"
          rulesSummary={rules.summary}
          rulesOverrideNote={playtime.rulesOverrideNote}
        />
      </main>
    );
  }

  const playtime = await prisma.playtime.findUnique({
    where: { slugNumber },
    include: {
      babies: { orderBy: { registrationOrder: "asc" } },
      matches: {
        include: { participants: { include: { baby: true } } },
        orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!playtime) notFound();

  const hasBotUsername = Boolean(process.env.TELEGRAM_BOT_USERNAME);
  const joinLink = hasBotUsername ? babyJoinDeepLink(playtime.joinToken) : null;
  const websiteLink = websiteJoinLink(playtime.joinToken);

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
    baby: { displayName: string | null; avatarId: string | null };
  }) => ({
    babyId: p.babyId,
    name: p.baby.displayName ?? "Unnamed baby",
    finishPosition: p.finishPosition,
    seedInMatch: p.seedInMatch,
    avatarSrc: resolveAvatarSrc(p.baby.avatarId),
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
    t,
  );

  const phase2Bracket = buildPhase2Bracket(
    playtime.matches.map((m) => ({
      kind: m.kind,
      status: m.status,
      participants: m.participants.map(toParticipant),
    })),
  );

  // Two tabs — the bracket/playpen view renders full-width above these,
  // not as a third tab, so it's always visible rather than switched away
  // from. "Matches" (where the admin actually takes action — reporting/
  // undoing results) defaults active, since that's what running the event
  // mostly means.
  const detailTabs: TabItem[] = [
    {
      id: "score",
      label: "Score",
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
                  <td className="py-1 pr-2">{baby.seed ?? "-"}</td>
                  <td className="py-1 pr-2">{baby.finalPlacement ?? "-"}</td>
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
      {/* self-start: a direct child of this flex-col container otherwise
          gets blockified + stretched to the full row width (a flex
          item's display is blockified per spec), so without this the
          link's own clickable area is the whole row, not just its text. */}
      <Link
        href="/playtimes"
        className="self-start text-sm font-semibold text-foreground-muted hover:opacity-80"
      >
        ← All playtimes
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{playtime.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-foreground-muted">
            <Badge variant={PLAYTIME_STATUS_DISPLAY[playtime.status].variant}>
              {PLAYTIME_STATUS_DISPLAY[playtime.status].label}
            </Badge>
            <span>
              {playtime.stationCount} station
              {playtime.stationCount === 1 ? "" : "s"}
            </span>
          </p>
          {playtime.status === "NURSERY_OPEN" && joinLink && (
            <p className="mt-1 break-all text-xs text-foreground-muted">Telegram: {joinLink}</p>
          )}
        </div>
        {playtime.status === "NURSERY_OPEN" && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <AddBabyManuallyButton playtimeId={playtime.id} />
            <StartPlaytimeButton playtimeId={playtime.id} babyCount={playtime.babies.length} />
          </div>
        )}
      </header>

      {playtime.status === "NURSERY_OPEN" &&
        (joinLink || websiteLink ? (
          // Breaks out of the admin layout's centered `max-w-5xl` column
          // (see playtimes/layout.tsx) so this grid gets the same full
          // screen width the public spectator view renders it at — inside
          // that narrower column the QR-pair + players grid never had
          // room to lay out as three columns and instead broke onto its
          // own cramped, wrapped stack.
          <div className="relative left-1/2 w-screen -translate-x-1/2 px-6 sm:px-8">
            <div className="mx-auto max-w-[1920px]">
              <NurseryCheckIn
                telegramLink={joinLink}
                websiteLink={websiteLink}
                playersTitle={`Registered babies (${playtime.babies.length})`}
              >
                {playtime.babies.length === 0 ? (
                  <p className="text-sm text-foreground-muted">Nobody yet.</p>
                ) : (
                  <ul className="flex w-full flex-col gap-1">
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
              </NurseryCheckIn>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Set TELEGRAM_BOT_USERNAME and/or NEXT_PUBLIC_APP_URL to show a join QR.
          </p>
        ))}

      {(playtime.status === "IN_PROGRESS" || playtime.status === "COMPLETE") && (
        <>
          {(playpens || phase2Bracket) && <PlaytimeBracketsView playpens={playpens} phase2Bracket={phase2Bracket} />}
          <Card>
            <Tabs label="Playtime details" items={detailTabs} defaultTabId="matches" />
          </Card>
        </>
      )}
    </div>
  );
}
