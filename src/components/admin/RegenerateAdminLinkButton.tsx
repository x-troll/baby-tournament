"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { regenerateAdminLinkTokenAction } from "@/server-actions/telegram-admin";

/** Invalidates the QR/link above and swaps in a fresh one — see the action's own comment for why this is manual rather than automatic. */
export function RegenerateAdminLinkButton() {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await regenerateAdminLinkTokenAction();
            setDone(true);
          })
        }
      >
        {isPending ? "Regenerating…" : "Regenerate this link"}
      </Button>
      {done && (
        <p role="status" className="text-xs text-foreground-muted">
          Done — the old QR code/link above no longer works, this page now shows the new one.
        </p>
      )}
    </div>
  );
}
