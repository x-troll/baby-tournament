"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { nukeDatabaseAction } from "@/server-actions/settings";

export function NukeDatabaseButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Nuke database
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Wipe everything and start fresh?">
        <p className="text-sm text-foreground-muted">
          This permanently deletes every playtime, baby, match, and help request — plus every admin
          account, including yours. A fresh admin is immediately re-created from this deployment&rsquo;s
          ADMIN_USERNAME/ADMIN_PASSWORD, and you&rsquo;ll be signed out. There&rsquo;s no undo.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(async () => nukeDatabaseAction())}
          >
            {isPending ? "Nuking…" : "Nuke everything"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
