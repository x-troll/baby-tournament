"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { babyLogoutAction } from "@/server-actions/baby-auth";

/**
 * "Sign out of this playtime" — a real card with a warning, not a bare
 * ghost button, plus a confirm step: there's no self-serve way back in
 * except the organizer's help or the original check-in link, so a stray
 * tap here shouldn't be one motion away from actually doing it. Mirrors
 * ConfirmDestructiveActionButton.tsx's trigger→Dialog→action shape, but
 * baby-toned (ghost trigger, not the admin danger-zone's red
 * `variant="destructive"`) since this isn't an irreversible admin action.
 * All copy is themed (src/lib/terminology.ts) and passed in — a client
 * component can't call getTerminology() itself.
 */
export function SignOutCard({
  slug,
  warning,
  confirmTitle,
  confirmBody,
  confirmButtonLabel,
}: {
  slug: string;
  warning: string;
  confirmTitle: string;
  confirmBody: string;
  confirmButtonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign out of this playtime</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground-muted">{warning}</p>
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}>
          Sign out of this playtime
        </Button>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title={confirmTitle}>
        <p className="text-sm text-foreground-muted">{confirmBody}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await babyLogoutAction(slug);
              })
            }
          >
            {isPending ? "Signing out…" : confirmButtonLabel}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
