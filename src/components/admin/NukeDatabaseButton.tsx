"use client";

import { ConfirmDestructiveActionButton } from "./ConfirmDestructiveActionButton";
import { nukeDatabaseAction } from "@/server-actions/settings";

export function NukeDatabaseButton() {
  return (
    <ConfirmDestructiveActionButton
      label="Nuke database"
      title="Wipe everything and start fresh?"
      description="This permanently deletes every playtime, baby, match, and help request, plus every admin account, including yours. A fresh admin is immediately re-created from this deployment's ADMIN_USERNAME/ADMIN_PASSWORD, and you'll be signed out. There's no undo."
      confirmLabel="Nuke everything"
      pendingLabel="Nuking…"
      action={nukeDatabaseAction}
    />
  );
}
