"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { startPlaytimeAction } from "@/server-actions/playtimes";

export function StartPlaytimeButton({ playtimeId, babyCount }: { playtimeId: string; babyCount: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canStart = babyCount >= 3;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!canStart}>
        Start playtime ({babyCount}/3 minimum)
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Start the tournament?">
        <p className="text-sm text-foreground-muted">
          {babyCount} babies are registered. Once started, check-in closes and the bracket begins — there&rsquo;s no
          going back to the nursery.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await startPlaytimeAction(playtimeId);
                setOpen(false);
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
