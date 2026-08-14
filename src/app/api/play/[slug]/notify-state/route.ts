import { NextResponse } from "next/server";
import { requireBaby } from "@/lib/baby-auth";
import { computeBabyStatus } from "@/lib/baby-status";
import { prisma } from "@/lib/prisma";

/**
 * Cookie-gated poll target for PlayPagePoller.tsx — the single poll loop
 * for both concerns the baby page needs live: `kind` for desktop
 * notification diffing (mirrors /api/playtime/[slug]/state's shape), and
 * `lastEventId` (the same append-only MatchEvent cursor
 * computeSpectatorState uses) so the client can skip `router.refresh()`
 * — previously a separate AutoRefresh component ran that full
 * server-component re-render unconditionally every 5s, regardless of
 * whether anything had actually changed. `cache: "no-store"` — this is
 * live per-baby state, never cacheable.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBaby(slug);
  const [state, lastEvent] = await Promise.all([
    computeBabyStatus(baby.id),
    prisma.matchEvent.findFirst({
      where: { match: { playtimeId: baby.playtimeId } },
      orderBy: { id: "desc" },
      select: { id: true },
    }),
  ]);
  return NextResponse.json(
    { kind: state.kind, lastEventId: lastEvent?.id ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
