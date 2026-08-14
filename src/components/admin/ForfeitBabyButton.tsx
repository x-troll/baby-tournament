"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { forfeitBabyAction } from "@/server-actions/playtimes";

/** A player who stops responding mid-event — see forfeitBaby's own doc comment (playtime-lifecycle.ts) for exactly what happens. Confirmed first since it's a real elimination, and shows the action's error inline rather than letting it crash the page (some scenarios — the round-robin stage, a pen already down to its last player — are deliberately refused). */
export function ForfeitBabyButton({ playtimeId, babyId, displayName }: { playtimeId: string; babyId: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Forfeit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Forfeit ${displayName}?`}>
        <p className="text-sm text-foreground-muted">
          For a player who&rsquo;s stopped responding (fell asleep, wandered off) — they&rsquo;re marked napped in
          last place among currently-active players, and whoever they were playing advances without them. There&rsquo;s
          no undo for this.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await forfeitBabyAction(playtimeId, babyId);
                  setOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Something went wrong.");
                }
              })
            }
          >
            {isPending ? "Forfeiting…" : "Forfeit"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
