"use client";

import { useActionState, useEffect, useState } from "react";
import { BabyProfileForm } from "./BabyProfileForm";
import type { UpdateBabyProfileState } from "@/server-actions/baby-profile";
import type { Baby } from "@/generated/prisma/client";

const initialState: UpdateBabyProfileState = {};

/** Self-dismissing "Saved!" toast — remounted via `key={savedAt}` on every successful save, so each one gets its own fresh 3s timer instead of needing to reset state from an effect. */
function SavedBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;
  return (
    <p
      role="status"
      className="rounded-card border-2 border-active bg-background-elevated px-4 py-2 text-center text-sm font-semibold text-active"
    >
      ✅ Saved!
    </p>
  );
}

/**
 * Client wrapper around BabyProfileForm for the settings page specifically
 * — register stays a plain server-rendered form (it redirects to a whole
 * new page on success, so there's nothing to keep in sync client-side),
 * but settings saves in place and needs two things a bare `<form
 * action={serverAction}>` can't give it:
 *
 * 1. A visible "Saved!" confirmation — nothing told the player their tap
 *    actually did anything before.
 * 2. A fix for fields silently "reverting" after a successful save: this
 *    form's inputs are uncontrolled (`defaultValue`/`defaultChecked`),
 *    and React only reads those props once, at mount — after Next
 *    revalidates this route post-save, the already-mounted `<select>`
 *    etc. keep whatever they showed before the edit, since a changed
 *    `defaultValue` on an existing element is simply ignored. Keying
 *    BabyProfileForm on `state.savedAt` forces a clean remount with the
 *    values that were actually just saved, so it reflects the save
 *    instead of quietly ignoring it.
 */
export function SettingsForm({
  baby,
  action,
}: {
  baby: Pick<Baby, "displayName" | "avatarId" | "selfRoleLabel" | "allowExplicitMessages" | "telegramChatId">;
  /** `updateBabyProfileAction.bind(null, slug)` — already missing its leading `slug` arg, matching useActionState's `(prevState, formData)` shape. */
  action: (prevState: UpdateBabyProfileState, formData: FormData) => Promise<UpdateBabyProfileState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const currentBaby = state.saved ? { ...baby, ...state.saved } : baby;

  return (
    <div className="flex flex-col gap-4">
      {state.savedAt && <SavedBanner key={state.savedAt} />}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      <BabyProfileForm
        key={state.savedAt ?? "initial"}
        action={formAction}
        mode="settings"
        baby={currentBaby}
        submitLabel={isPending ? "Saving…" : "Save"}
        pending={isPending}
      />
    </div>
  );
}
