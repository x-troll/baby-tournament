import { Avatar } from "@/components/ui/Avatar";
import type { SpectatorParticipant } from "@/lib/spectator-state";

/**
 * Kahoot-style "who's joined" badge row for the waiting-room screen —
 * shown next to the join QR while status is NURSERY_OPEN, so the room
 * sees names populate live as babies scan in via Telegram (the poller
 * already refreshes this every tick, nothing bespoke needed here).
 *
 * `newlyJoinedIds` (computed by SpectatorPoller, diffing each poll
 * against the previous one) drives a one-shot bounce-in on exactly the
 * badges that showed up since the last tick — everyone else renders
 * plain, so the room's eye is drawn to whoever just joined.
 */
export function RegisteredBabies({
  babies,
  newlyJoinedIds = new Set(),
}: {
  babies: SpectatorParticipant[];
  newlyJoinedIds?: Set<string>;
}) {
  if (babies.length === 0) {
    return <p className="text-center text-foreground-muted">Waiting for babies to check in…</p>;
  }
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {babies.map((b) => (
        <div
          key={b.babyId}
          className={`flex items-center gap-2 rounded-full border-2 border-border bg-background-elevated py-2 pl-2 pr-4 shadow-soft ${
            newlyJoinedIds.has(b.babyId) ? "animate-badge-bounce-in motion-reduce:animate-none" : ""
          }`}
        >
          <Avatar src={b.avatarSrc} size={56} />
          <span className="font-display text-lg font-bold">{b.name}</span>
        </div>
      ))}
    </div>
  );
}
