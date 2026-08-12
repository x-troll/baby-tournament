import Image from "next/image";
import type { SpectatorParticipant } from "@/lib/spectator-state";

/**
 * Kahoot-style "who's joined" badge row for the waiting-room screen —
 * shown next to the join QR while status is NURSERY_OPEN, so the room
 * sees names populate live as babies scan in via Telegram (the poller
 * already refreshes this every tick, nothing bespoke needed here).
 */
export function RegisteredBabies({ babies }: { babies: SpectatorParticipant[] }) {
  if (babies.length === 0) {
    return <p className="text-center text-foreground-muted">Waiting for babies to check in…</p>;
  }
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {babies.map((b) => (
        <div
          key={b.babyId}
          className="flex items-center gap-2 rounded-full border-2 border-border bg-background-elevated py-2 pl-2 pr-4 shadow-soft"
        >
          {b.avatarSrc ? (
            <Image src={b.avatarSrc} alt="" width={32} height={32} className="shrink-0 rounded-full" />
          ) : (
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background-sunken text-lg">
              🍼
            </span>
          )}
          <span className="font-display text-lg font-bold">{b.name}</span>
        </div>
      ))}
    </div>
  );
}
