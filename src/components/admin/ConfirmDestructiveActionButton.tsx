"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Shared shape for DeleteAllPlaytimesButton/NukeDatabaseButton — same
 * "trigger button -> confirm dialog -> destructive action" flow, only the
 * copy and the bound action differ. If `action` redirects (NukeDatabase
 * does, to /login), the dialog never gets a chance to close itself —
 * that's fine, the redirect unmounts everything anyway.
 */
export function ConfirmDestructiveActionButton({
  label,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-sm text-foreground-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await action();
                setOpen(false);
              })
            }
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
