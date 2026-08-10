import { prisma } from "@/lib/prisma";
import { requireBaby } from "@/lib/baby-auth";
import { computeBabyStatus } from "@/lib/baby-status";
import { getTerminology } from "@/lib/terminology";
import { loadRules } from "@/lib/rules-content";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RulesBar } from "@/components/rules/RulesBar";
import { StatusCard } from "@/components/baby/StatusCard";
import { StarChart, type StarChartRow } from "@/components/baby/StarChart";
import { RequestHelpButton } from "@/components/baby/RequestHelpButton";
import type { ReportableParticipant } from "@/components/baby/ResultReportForm";

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBaby(slug);
  const playtime = await prisma.playtime.findUniqueOrThrow({ where: { slug } });
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

  // Resolved to plain strings here, server-side — StatusCard is a client
  // component and can't receive the Terminology object itself (it carries
  // functions, which can't cross the server/client boundary).
  const statusCardCopy = {
    champion: t.champion,
    matchWin: t.matchWin,
    registration: t.registration,
    waitingForMatchCapitalized: t.waitingForMatch[0]!.toUpperCase() + t.waitingForMatch.slice(1),
    nappedMessage: state.kind === "NAPPED" ? t.eliminatedWithPlacement(state.placement ?? 0) : undefined,
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

      <h1 className="sr-only">
        {playtime.name} — {t.player} screen
      </h1>

      <StatusCard
        slug={slug}
        state={state}
        copy={statusCardCopy}
        currentMatchParticipants={currentMatchParticipants}
      />

      <StarChart rows={starChartRows} currentBabyId={baby.id} />

      <RequestHelpButton slug={slug} adminLabel={t.admin} />
    </main>
  );
}
