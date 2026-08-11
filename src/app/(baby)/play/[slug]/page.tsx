import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireBaby } from "@/lib/baby-auth";
import { parseSlugNumber } from "@/lib/slug-number";
import { computeBabyStatus } from "@/lib/baby-status";
import { getTerminology } from "@/lib/terminology";
import { resolveAvatarSrc } from "@/lib/avatars";
import { loadRules } from "@/lib/rules-content";
import * as playerCopy from "@/lib/player-copy";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RulesBar } from "@/components/rules/RulesBar";
import { StatusCard, type StatusCardCopy } from "@/components/baby/StatusCard";
import { StarChart, type StarChartRow } from "@/components/baby/StarChart";
import { RequestHelpButton } from "@/components/baby/RequestHelpButton";
import type { ReportableParticipant } from "@/components/baby/ResultReportForm";

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBaby(slug);
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

  const allBabies = await prisma.baby.findMany({
    where: { playtimeId: playtime.id },
    orderBy: [{ status: "asc" }, { finalPlacement: "asc" }, { registrationOrder: "asc" }],
  });
  const goldStarCounts = await prisma.matchParticipant.groupBy({
    by: ["babyId"],
    where: { babyId: { in: allBabies.map((b) => b.id) }, finishPosition: 1 },
    _count: { _all: true },
  });
  const goldStarMap = new Map(goldStarCounts.map((g) => [g.babyId, g._count._all]));
  const starChartRows: StarChartRow[] = allBabies.map((b) => ({
    babyId: b.id,
    displayName: b.displayName,
    status: b.status,
    finalPlacement: b.finalPlacement,
    goldStars: goldStarMap.get(b.id) ?? 0,
  }));

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
    waitingOnPlaymatesLine: playerCopy.cardWaitingOnPlaymates(baby),
    confirmationAskLine: playerCopy.cardConfirmationAsk(
      baby,
      state.kind === "AWAITING_YOUR_CONFIRMATION" ? state.reporterName : null,
    ),
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      <AutoRefresh />

      <RulesBar
        game={playtime.game}
        summary={rules.summary}
        bodyHtml={rules.bodyHtml}
        screenshots={rules.screenshots}
        overrideNote={playtime.rulesOverrideNote}
      />

      <div className="flex items-center justify-between gap-2">
        <h1 className="sr-only">
          {playtime.name} — {t.player} screen
        </h1>
        {resolveAvatarSrc(baby.avatarId) && (
          <Image
            src={resolveAvatarSrc(baby.avatarId)!}
            alt=""
            width={40}
            height={40}
            className="rounded-full"
          />
        )}
        <Link href={`/play/${slug}/settings`} className="ml-auto text-sm font-semibold text-foreground-muted underline">
          ⚙️ Settings
        </Link>
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
      />

      <StarChart rows={starChartRows} currentBabyId={baby.id} viewerBaby={baby} />

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
