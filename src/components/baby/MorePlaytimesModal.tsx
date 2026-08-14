"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { joinAnotherPlaytimeAction } from "@/server-actions/baby-join";
import { GAME_DISPLAY } from "@/lib/enum-display";
import type { Game } from "@/generated/prisma/enums";

export interface JoinablePlaytime {
  slugNumber: number;
  name: string;
  game: Game;
}

/**
 * "More playtime!" on /playtimes — lets an already-signed-in baby join a
 * second still-open playtime (see joinAnotherPlaytimeAction). Every row
 * is its own tiny form, not one shared submit, so each can carry its own
 * slugNumber without any client-side state beyond which dialog is open —
 * same shape as CreatePlaytimeButton.tsx.
 */
export function MorePlaytimesModal({
  buttonLabel,
  joinable,
}: {
  buttonLabel: string;
  joinable: JoinablePlaytime[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{buttonLabel}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Join another playtime">
        {joinable.length === 0 ? (
          <p className="text-sm text-foreground-muted">Nothing else open right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {joinable.map((p) => {
              const game = GAME_DISPLAY[p.game];
              return (
                <li
                  key={p.slugNumber}
                  className="flex items-center justify-between gap-3 rounded-card border border-border bg-background px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <Badge variant={game.variant}>{game.label}</Badge>
                  </span>
                  <form action={joinAnotherPlaytimeAction.bind(null, String(p.slugNumber))}>
                    <Button type="submit" size="sm">
                      Join
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );
}
