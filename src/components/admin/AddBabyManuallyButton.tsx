"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { addBabyManuallyAction } from "@/server-actions/playtimes";

// addBabyManuallyAction only revalidates (no redirect, unlike
// createPlaytimeAction) — nothing navigates the dialog closed for free.
// Submits manually (not a plain `<form action>`) so the dialog can wait
// for the actual result before closing — closes on a genuine success,
// not optimistically on submit, so a rejected add (e.g. the playtime
// started in another tab while this dialog sat open) shows its error
// inline instead of the dialog vanishing right as the action fails.
export function AddBabyManuallyButton({ playtimeId }: { playtimeId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await addBabyManuallyAction(playtimeId, {}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add baby manually
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a baby manually">
        <form ref={formRef} action={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="displayName" className="text-sm font-semibold">
              Display name
            </label>
            <Input id="displayName" name="displayName" placeholder="Display name" required />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="self-start" disabled={isPending}>
            {isPending ? "Adding…" : "Add"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
