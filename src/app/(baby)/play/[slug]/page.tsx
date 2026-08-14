import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { prisma } from "@/lib/prisma";
import { requireBabyWithToken } from "@/lib/baby-auth";
import { parseSlugNumber } from "@/lib/slug-number";
import { computeBabyStatus } from "@/lib/baby-status";
import { getTerminology } from "@/lib/terminology";
import { resolveAvatarSrc } from "@/lib/avatars";
import { loadRules } from "@/lib/rules-content";
import * as playerCopy from "@/lib/player-copy";
import { buttonVariants } from "@/components/ui/button";
import { StatusCard, type StatusCardCopy } from "@/components/baby/StatusCard";
import { RequestHelpButton } from "@/components/baby/RequestHelpButton";
import { PlayPagePoller } from "@/components/baby/PlayPagePoller";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import { computeSpectatorState } from "@/lib/spectator-state";
import type { ReportableParticipant } from "@/components/baby/ResultReportForm";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  const baby = await requireBabyWithToken(slug, token);
  // requireBaby already redirected away if `slug` weren't a valid, existing
  // playtime — safe to assert non-null here.
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
          href={`/play/${slug}/settings`}
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

      <PlaytimeBracketsView playpens={spectatorState?.playpens ?? null} phase2Bracket={spectatorState?.phase2Bracket ?? null} />

      <RequestHelpButton
        slug={slug}
        copy={{
          notifiedAck: playerCopy.helpNotifiedAck(baby),
          requestButtonLabel: playerCopy.helpRequestButtonLabel(baby),
        }}
      />
    </main>
  );
}
