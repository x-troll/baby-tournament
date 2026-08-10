import { CountdownTimer } from "@/components/baby/CountdownTimer";
import type { SpectatorMatch, SpectatorParticipant } from "@/lib/spectator-state";

export function CurrentMatches({ matches, onDeck }: { matches: SpectatorMatch[]; onDeck: SpectatorParticipant[] }) {
  return (
    <div className="flex flex-col gap-4">
      {matches.length === 0 ? (
        <p className="text-center text-xl text-foreground-muted">Between matches…</p>
      ) : (
        matches.map((m) => (
          <div key={m.matchId} className="rounded-card border-2 border-border bg-background-elevated p-5 shadow-soft">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              {m.stationNumber ? `Station ${m.stationNumber}` : "Playing now"}
              {m.disputed && <span className="ml-2 text-danger">⚠️ Disputed</span>}
            </p>
            <p className="font-display text-2xl font-bold sm:text-3xl">
              {m.participants.map((p) => p.name).join(" vs ")}
            </p>
            {m.status === "REPORTED" && m.deadlineAt && (
              <div className="mt-2">
                <p className="text-sm text-foreground-muted">Confirming automatically in…</p>
                <CountdownTimer deadline={new Date(m.deadlineAt)} doneLabel="Confirmed" />
              </div>
            )}
          </div>
        ))
      )}

      {onDeck.length > 0 && (
        <p className="text-center text-lg text-foreground-muted">On deck: {onDeck.map((p) => p.name).join(", ")}</p>
      )}
    </div>
  );
}
