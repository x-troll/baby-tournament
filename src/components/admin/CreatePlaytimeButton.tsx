"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { createPlaytimeAction } from "@/server-actions/playtimes";
import { Game } from "@/generated/prisma/enums";

// The form itself is unchanged from before this became a modal —
// createPlaytimeAction redirects to the new playtime's detail page on
// success, which navigates the whole page away and closes this dialog for
// free, no extra plumbing needed.
export function CreatePlaytimeButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Playtime</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Create a playtime">
        <form action={createPlaytimeAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-semibold">
              Name
            </label>
            <Input id="name" name="name" required placeholder="Friday Night Playtime" />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Game</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="game" value={Game.MARIO_KART} defaultChecked required />
                Mario Kart
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="game" value={Game.SUPER_SMASH} />
                Super Smash Bros
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="stationCount" className="text-sm font-semibold">
              Stations
            </label>
            <Input id="stationCount" name="stationCount" type="number" min={1} defaultValue={1} className="w-24" />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="rulesOverrideNote" className="text-sm font-semibold">
              Tonight-only rules note <span className="font-normal text-foreground-muted">(optional)</span>
            </label>
            <Input id="rulesOverrideNote" name="rulesOverrideNote" placeholder="e.g. 3 races per match tonight" />
          </div>

          <Button type="submit" className="mt-2 self-start">
            Create playtime
          </Button>
        </form>
      </Dialog>
    </>
  );
}
