"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { addBabyManuallyAction } from "@/server-actions/playtimes";

// addBabyManuallyAction only revalidates (no redirect, unlike
// createPlaytimeAction) — nothing navigates the dialog closed for free,
// so this closes it optimistically on submit; the babies list underneath
// updates via the action's own revalidatePath either way.
export function AddBabyManuallyButton({ playtimeId }: { playtimeId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add baby manually
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a baby manually">
        <form
          action={addBabyManuallyAction.bind(null, playtimeId)}
          onSubmit={() => setOpen(false)}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="displayName" className="text-sm font-semibold">
              Display name
            </label>
            <Input id="displayName" name="displayName" placeholder="Display name" required />
          </div>
          <Button type="submit" className="self-start">
            Add
          </Button>
        </form>
      </Dialog>
    </>
  );
}
