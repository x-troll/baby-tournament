"use client";

import { useEffect, useRef, useState } from "react";
import { StageBanner } from "./StageBanner";
import { CurrentMatches } from "./CurrentMatches";
import { HelpIndicator } from "./HelpIndicator";
import { RegisteredBabies } from "./RegisteredBabies";
import { NurseryCheckIn } from "./NurseryCheckIn";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import { GAME_LOGO_SRC } from "@/lib/game-assets";
import type { SpectatorState } from "@/lib/spectator-state";

const POLL_INTERVAL_MS = 3000;

/**
 * Polling, not SSE (see PLAN.md Phase 1: Heroku's router kills idle
 * connections after 55s, dyno restarts drop long-lived ones anyway).
 * `?since=<lastEventId>` makes most polls cheap — the server replies
 * `{ unchanged: true }` instead of re-shipping the full state when
 * nothing happened, reusing the append-only MatchEvent log as the cursor.
 *
 * No playtime title, no star chart/score board — deliberately trimmed to
 * just what's happening right now (help indicator, stage banner, current
 * matches, the bracket itself). The star chart is still real data
 * (`state.starChart`), just no longer rendered on this screen.
 */
export function SpectatorPoller({ slug, initial }: { slug: string; initial: SpectatorState }) {
  const [state, setState] = useState(initial);
  const [newlyJoinedIds, setNewlyJoinedIds] = useState<Set<string>>(new Set());
  // Whatever babyIds were already known as of the last render — not
  // component state itself (a ref update shouldn't trigger a re-render
  // on its own), just the comparison point each poll diffs against.
  // Seeded from the initial server-rendered list so babies who joined
  // before this page ever loaded don't bounce in on first paint.
  const knownBabyIdsRef = useRef<Set<string>>(new Set(initial.registeredBabies.map((b) => b.babyId)));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/playtime/${slug}/state?since=${state.lastEventId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.unchanged || cancelled) return;

        const nextState: SpectatorState = json.state;
        const freshlyJoined = new Set(
          nextState.registeredBabies.map((b) => b.babyId).filter((id) => !knownBabyIdsRef.current.has(id)),
        );
        knownBabyIdsRef.current = new Set(nextState.registeredBabies.map((b) => b.babyId));

        setState(nextState);
        setNewlyJoinedIds(freshlyJoined);
      } catch {
        // Network hiccup — just try again next tick, nothing to surface on a TV.
      }
    }

    // Re-subscribes each time lastEventId changes so the next poll's
    // `since` is always current — a stale closure would keep polling
    // with an outdated cursor forever.
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, state.lastEventId]);

  return (
    <div className="mx-auto flex max-w-[1920px] flex-col gap-6 p-8">
      <HelpIndicator count={state.openHelpRequestCount} adminTerm={state.adminTerm} />

      <StageBanner
        text={state.stageBanner}
        logoSrc={GAME_LOGO_SRC[state.game]}
        trailingAvatarSrc={state.status === "COMPLETE" ? (state.bestBaby?.avatarSrc ?? null) : undefined}
      />

      {state.status === "NURSERY_OPEN" && (
        <NurseryCheckIn telegramLink={state.joinLink} websiteLink={state.websiteJoinLink}>
          <RegisteredBabies babies={state.registeredBabies} newlyJoinedIds={newlyJoinedIds} />
        </NurseryCheckIn>
      )}

      {state.status === "IN_PROGRESS" && <CurrentMatches matches={state.activeMatches} onDeck={state.onDeck} />}

      <PlaytimeBracketsView playpens={state.playpens} phase2Bracket={state.phase2Bracket} />
    </div>
  );
}
