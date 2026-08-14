"use client";

import { ConfirmDestructiveActionButton } from "./ConfirmDestructiveActionButton";
import { deleteAllPlaytimesAction } from "@/server-actions/playtimes";

export function DeleteAllPlaytimesButton() {
  return (
    <ConfirmDestructiveActionButton
      label="Delete all tournaments"
      title="Delete every playtime?"
      description="This permanently deletes every playtime, baby, match, and help request, everything. There's no undo."
      confirmLabel="Delete everything"
      pendingLabel="Deleting…"
      action={deleteAllPlaytimesAction}
    />
  );
}
