import { NextRequest, NextResponse } from "next/server";
import { computeSpectatorState } from "@/lib/spectator-state";

/**
 * Unauthenticated, read-only — the spectator screen's poll target.
 * `?since=<lastEventId>` lets the client skip re-rendering when nothing
 * happened: cheap "unchanged" responses instead of always shipping the
 * full state, reusing the append-only MatchEvent log as the "did
 * anything happen" cursor (see PLAN.md — the same log that powers undo).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const since = Number(request.nextUrl.searchParams.get("since") ?? "0");

  const state = await computeSpectatorState(slug);
  if (!state) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (Number.isFinite(since) && since > 0 && state.lastEventId <= since) {
    return NextResponse.json({ unchanged: true, lastEventId: state.lastEventId });
  }

  return NextResponse.json({ unchanged: false, state });
}
