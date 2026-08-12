"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteAllPlaytimesAction } from "@/server-actions/playtimes";

export function DeleteAllPlaytimesButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete all tournaments
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete every playtime?">
        <p className="text-sm text-foreground-muted">
          This permanently deletes every playtime, baby, match, and help request, everything. There&rsquo;s no undo.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteAllPlaytimesAction();
                setOpen(false);
              })
            }
          >
            {isPending ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
