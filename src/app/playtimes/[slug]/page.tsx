import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { getCurrentBaby, requireBabyWithToken } from "@/lib/baby-auth";
import { parseSlugNumber } from "@/lib/slug-number";
import { computeSpectatorState } from "@/lib/spectator-state";
import { computeBabyStatus } from "@/lib/baby-status";
import { loadRules } from "@/lib/rules-content";
import { resolveAvatarSrc } from "@/lib/avatars";
import * as playerCopy from "@/lib/player-copy";
import { babyJoinDeepLink, websiteJoinLink } from "@/lib/qr";
import { getTerminology } from "@/lib/terminology";
import { describeMatchKind } from "@/lib/match-label";
import { toDisplayStatus } from "@/lib/match-status";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import { AddBabyManuallyButton } from "@/components/admin/AddBabyManuallyButton";
import { StartPlaytimeButton } from "@/components/admin/StartPlaytimeButton";
import { ForfeitBabyButton } from "@/components/admin/ForfeitBabyButton";
import { SpectatorPoller } from "@/components/spectator/SpectatorPoller";
import { NurseryCheckIn } from "@/components/spectator/NurseryCheckIn";
import { StatusCard, type StatusCardCopy } from "@/components/baby/StatusCard";
import { RequestHelpButton } from "@/components/baby/RequestHelpButton";
import { PlayPagePoller } from "@/components/baby/PlayPagePoller";
import type { ReportableParticipant } from "@/components/baby/ResultReportForm";
import { PLAYTIME_STATUS_DISPLAY } from "@/lib/enum-display";
import { removeBabyAction } from "@/server-actions/playtimes";
import { reportMatchResultFormAction, undoMatchResultAction } from "@/server-actions/matches";
import { previewAsBabyAction } from "@/server-actions/baby-auth";
import type { Baby } from "@/generated/prisma/client";

/**
 * Replaces /live/[slug] (public spectator screen), /admin/playtimes/[id]
 * (admin control panel), AND the old /play/[slug] tree (a signed-in
 * baby's own screen + register/settings) — one URL, keyed on the
 * public-facing slugNumber, branching three ways on who's looking:
 * admin -> control panel, a baby with real intent for *this* playtime ->
 * their play screen, everyone else -> the public spectator view.
 *
 * `?playerPreview=true` (set by previewAsBabyAction) makes an admin skip
 * their own admin branch and see the baby branch instead, for "Preview
 * as baby" — see the baby-intent check below.
 */
export default async function PlaytimeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; playerPreview?: string }>;
}) {
  const { slug } = await params;
  const { token, playerPreview: playerPreviewRaw } = await searchParams;
  const playerPreview = playerPreviewRaw === "true";
  const slugNumber = parseSlugNumber(slug);
  if (slugNumber === null) notFound();

  // Existence + id only, shared by the baby-intent check below — the
  // admin/public branches each still run their own richer query for
  // their own data, same as before this page had a third branch.
  const playtimeRef = await prisma.playtime.findUnique({ where: { slugNumber }, select: { id: true } });
  if (!playtimeRef) notFound();

  const admin = await getCurrentAdmin();

  if (admin && !playerPreview) {
    return <AdminBranch slug={slug} slugNumber={slugNumber} />;
  }

  // Entered whenever there's real baby intent for *this* playtime — a
  // normal player, an admin previewing (?playerPreview=true), or a fresh
  // magic-link/bookmark `?token=` visit — so a random visitor (or an
  // admin not previewing anyone) still falls through to the public
  // spectator view below instead of a dead-end auth screen.
  const currentBaby = await getCurrentBaby();
  if (token || currentBaby?.playtimeId === playtimeRef.id) {
    const baby = await requireBabyWithToken(slug, token);
    return <BabyBranch slug={slug} baby={baby} token={token} playerPreview={playerPreview} />;
  }

  return <PublicSpectatorBranch slug={slug} slugNumber={slugNumber} />;
}

async function PublicSpectatorBranch({ slug, slugNumber }: { slug: string; slugNumber: number }) {
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

async function BabyBranch({
  slug,
  baby,
  token,
  playerPreview,
}: {
  slug: string;
  baby: Baby;
  token: string | undefined;
  playerPreview: boolean;
}) {
  // requireBabyWithToken already redirected away if `slug` weren't a
  // valid, existing playtime — safe to assert non-null here.
  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { slugNumber: parseSlugNumber(slug)! } });
  const t = getTerminology();

  const state = await computeBabyStatus(baby.id);

  let currentMatchParticipants: ReportableParticipant[] | undefined;
  if (state.kind === "PLAYING") {
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: state.matchId },
      include: { participants: { include: { baby: true } } },
    });
    currentMatchParticipants = match.participants.map((p) => ({
      babyId: p.babyId,
      displayName: p.baby.displayName,
      goldStarLabel: playerCopy.goldStarButtonLabel(baby, p.baby.displayName ?? "Unnamed baby"),
    }));
  }

  // Reuses the same view-model the spectator screen/admin panel build
  // their bracket diagram from (src/lib/spectator-state.ts) — same data,
  // same PlaytimeBracketsView component, instead of this page keeping
  // its own standings table in sync separately.
  const spectatorState = await computeSpectatorState(slug);

  const rules = await loadRules(playtime.game);

  // Every line resolved server-side, from this baby's own /profile
  // choices (src/lib/player-copy.ts) — StatusCard/RequestHelpButton/
  // ResultReportForm are client components and can't call these
  // themselves (functions can't cross the server/client boundary).
  const statusCardCopy: StatusCardCopy = {
    organizerComing: playerCopy.cardOrganizerComing(baby),
    championLine: playerCopy.cardChampion(baby),
    nappedLine: state.kind === "NAPPED" ? playerCopy.cardNapped(baby, state.placement ?? 0) : undefined,
    notStartedLine: playerCopy.cardNotStarted(baby),
    waitingEtaLine: playerCopy.cardWaitingEta(baby, state.kind === "QUIET_TIME" ? state.etaMinutes : null),
    upNextLine: playerCopy.cardUpNext(baby),
    startMatchButtonLabel: playerCopy.cardStartMatchButtonLabel(baby),
    playingLine: playerCopy.cardPlaying(baby),
  };

  // Carried through the settings-gear link so an admin previewing this
  // baby (see previewAsBabyAction) stays in preview after clicking in —
  // settings.tsx carries it back out the same way on its own Back link.
  const previewQuery = playerPreview ? "?playerPreview=true" : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      {token && (
        // Only babies who arrived via the website join flow ever land
        // here with ?token= — Telegram's magic link already strips it
        // via /nursery/verify's redirect. This is exactly the URL to
        // bookmark: it still logs them back in even with no cookie
        // (cleared, or a different device) — see requireBabyWithToken.
        <div className="rounded-card border-2 border-border bg-background-sunken p-3 text-center text-sm font-semibold">
          📌 This is your personal link, bookmark this page now so you can get back in later.
        </div>
      )}

      {/* {avatar} {title} {settings icon} as one inline, centered group —
          the notification-permission button is conditional/optional (see
          PlayPagePoller — renders null once granted/denied/unsupported),
          so it stays absolutely positioned off to the side instead of
          being a real flex sibling, to avoid its presence/absence
          shifting the avatar+title+settings group's centering. */}
      <div className="relative flex items-center justify-center gap-3">
        <h2 className="sr-only">
          {playtime.name}, {t.player} screen
        </h2>
        {resolveAvatarSrc(baby.avatarId) && <Avatar src={resolveAvatarSrc(baby.avatarId)} size={70} />}
        <h1 className="font-display text-2xl font-bold">
          Welcome, {baby.selfRoleLabel ? `${baby.selfRoleLabel} ${baby.displayName}` : baby.displayName}
        </h1>
        <Link
          href={`/playtimes/${slug}/settings${previewQuery}`}
          aria-label="Settings"
          className={buttonVariants({ variant: "secondary", size: "icon" })}
        >
          <span aria-hidden>⚙️</span>
        </Link>
        <div className="absolute right-0">
          <PlayPagePoller slug={slug} championLabel={t.champion} />
        </div>
      </div>

      <StatusCard
        slug={slug}
        state={state}
        copy={statusCardCopy}
        currentMatchParticipants={currentMatchParticipants}
        reportFormCopy={{
          goldStarPrompt: playerCopy.goldStarPrompt(baby),
          dragInstruction: playerCopy.dragInstruction(baby),
        }}
        rules={
          state.kind === "UP_NEXT"
            ? {
                game: playtime.game,
                summary: rules.summary,
                bodyHtml: rules.bodyHtml,
                screenshots: rules.screenshots,
                overrideNote: playtime.rulesOverrideNote,
              }
            : undefined
        }
      />

      <PlaytimeBracketsView
        playpens={spectatorState?.playpens ?? null}
        phase2Bracket={spectatorState?.phase2Bracket ?? null}
        mobileFullBleed
      />

      <RequestHelpButton
        slug={slug}
        copy={{
          notifiedAck: playerCopy.helpNotifiedAck(baby),
          requestButtonLabel: playerCopy.helpRequestButtonLabel(baby),
          whatsUpHeading: playerCopy.helpWhatsUpPrompt(baby),
          reasonOptions: playerCopy.helpReasonOptions(baby),
        }}
      />
    </main>
  );
}

async function AdminBranch({ slug, slugNumber }: { slug: string; slugNumber: number }) {
  // The bracket/playpen diagram (playpens/phase2Bracket below) reuses
  // computeSpectatorState — the same view-model the public spectator
  // screen and the baby screen already build their own copy of the same
  // diagram from — instead of this page re-deriving it from a second,
  // independently-written query. What's left in this page's own query is
  // only the admin-specific extras computeSpectatorState's public-facing
  // shape doesn't carry: seed/finalPlacement/telegramChatId per baby, and
  // full match participant rows for the Matches tab's report/undo forms.
  const [playtime, spectatorState] = await Promise.all([
    prisma.playtime.findUnique({
      where: { slugNumber },
      include: {
        babies: { orderBy: { registrationOrder: "asc" } },
        matches: {
          include: { participants: { include: { baby: true } } },
          orderBy: [{ round: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    computeSpectatorState(slug),
  ]);
  if (!playtime || !spectatorState) notFound();

  const hasBotUsername = Boolean(process.env.TELEGRAM_BOT_USERNAME);
  const joinLink = hasBotUsername ? babyJoinDeepLink(playtime.joinToken) : null;
  const websiteLink = websiteJoinLink(playtime.joinToken);

  const activeCount = playtime.babies.filter((b) => b.status === "ACTIVE").length;
  // Matches the same "only a finished registration counts" filter
  // startPlaytime itself applies (playtime-lifecycle.ts) — a nameless
  // check-in (Telegram link tapped, /register never finished) shouldn't
  // enable the Start button or be promised a spot in the bracket.
  const registeredCount = playtime.babies.filter((b) => b.displayName != null).length;
  const t = getTerminology();

  // Once the playtime is finished every baby has a finalPlacement — show
  // the Score tab in that order (1st, 2nd, 3rd, ...) instead of
  // registration order. While still in progress most babies don't have
  // one yet, so registration order (the fetch's default) stays clearest.
  const scoreTableBabies =
    playtime.status === "COMPLETE"
      ? [...playtime.babies].sort((a, b) => (a.finalPlacement ?? 999) - (b.finalPlacement ?? 999))
      : playtime.babies;

  const { playpens, phase2Bracket } = spectatorState;

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
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {scoreTableBabies.map((baby) => (
                <tr key={baby.id} className="border-b border-border last:border-0">
                  <td className="py-1 pr-2">{baby.displayName ?? "(no name)"}</td>
                  <td className="py-1 pr-2">
                    {baby.status === "CHAMPION" ? `🌟 ${t.champion}` : baby.status === "NAPPED" ? "Napping" : "Active"}
                  </td>
                  <td className="py-1 pr-2">{baby.seed ?? "-"}</td>
                  <td className="py-1 pr-2">{baby.finalPlacement ?? "-"}</td>
                  <td className="py-1">
                    <span className="flex justify-end gap-1">
                      <form action={previewAsBabyAction.bind(null, baby.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Preview
                        </Button>
                      </form>
                      {playtime.status === "IN_PROGRESS" && baby.status === "ACTIVE" && (
                        <ForfeitBabyButton
                          playtimeId={playtime.id}
                          babyId={baby.id}
                          displayName={baby.displayName ?? "this baby"}
                        />
                      )}
                    </span>
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
                  {describeMatchKind(t, match.kind, match.round)}
                  {match.penIndex != null ? ` · pen ${match.penIndex + 1}` : ""} ·{" "}
                  {t.matchStatusLabel[toDisplayStatus(match.status, false)]}
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
      <Link href="/playtimes" className="self-start text-sm font-semibold text-foreground-muted hover:opacity-80">
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
            <StartPlaytimeButton playtimeId={playtime.id} babyCount={registeredCount} />
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
