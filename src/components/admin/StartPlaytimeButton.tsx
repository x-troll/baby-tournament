"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { startPlaytimeAction } from "@/server-actions/playtimes";

export function StartPlaytimeButton({ playtimeId, babyCount }: { playtimeId: string; babyCount: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canStart = babyCount >= 3;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!canStart}>
        {canStart ? "Start playtime" : "Not enough babies yet"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Start the tournament?">
        <p className="text-sm text-foreground-muted">
          {babyCount} babies are registered. Once started, check-in closes and the bracket begins. There&rsquo;s no
          going back to the nursery.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                // Caught, not left to crash the page — a double-click or a
                // second admin tab racing this same button both hit the
                // same "already started" guard server-side.
                try {
                  await startPlaytimeAction(playtimeId);
                  setOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Something went wrong.");
                }
              })
            }
          >
            {isPending ? "Starting…" : "Start playtime"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
