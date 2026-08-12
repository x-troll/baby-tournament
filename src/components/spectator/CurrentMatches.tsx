import type { SpectatorMatch, SpectatorParticipant } from "@/lib/spectator-state";

export function CurrentMatches({ matches, onDeck }: { matches: SpectatorMatch[]; onDeck: SpectatorParticipant[] }) {
  return (
    <div className="flex flex-col gap-4">
      {matches.length === 0 ? (
        <p className="text-center text-xl text-foreground-muted">Between matches…</p>
      ) : (
        matches.map((m) => {
          // READY (stationed, not yet tapped "we're playing") reads
          // differently from IN_PROGRESS/REPORTED (actually underway) —
          // previously both rendered identically under one shared label.
          const isReady = m.status === "READY";
          return (
            <div key={m.matchId} className="rounded-card border-2 border-border bg-background-elevated p-5 shadow-soft">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                {isReady ? "Get ready to play." : "Currently playing."}
              </p>
              <p className="font-display text-2xl font-bold sm:text-3xl">
                {m.participants.map((p) => p.name).join(" vs ")}
              </p>
              {isReady && (
                <p className="mt-1 text-sm text-foreground-muted">
                  Remember to click &ldquo;Start playing&rdquo; inside Telegram.
                </p>
              )}
            </div>
          );
        })
      )}

      {onDeck.length > 0 && (
        <p className="text-center text-lg text-foreground-muted">On deck: {onDeck.map((p) => p.name).join(", ")}</p>
      )}
    </div>
  );
}
