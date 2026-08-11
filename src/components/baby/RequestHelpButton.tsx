"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createHelpRequestAction } from "@/server-actions/help-requests";

const REASONS = ["Controller trouble", "Can't find my opponent", "Score dispute", "Something else"] as const;

export interface RequestHelpButtonCopy {
  notifiedAck: string;
  requestButtonLabel: string;
}

/**
 * Persistent on every baby-facing screen — big soft pill, always
 * reachable. Reason chips + free text for "something else"; 60s
 * cooldown and thread-collapsing are enforced server-side
 * (src/server-actions/help-requests.ts), this just surfaces whatever it
 * reports back.
 *
 * `copy` is passed in (src/lib/player-copy.ts, resolved server-side)
 * rather than computed here: this is a client component, and both
 * getTerminology() (reads process.env.THEME, not NEXT_PUBLIC_-prefixed,
 * so invisible client-side) and the 4-variant picker need the viewing
 * baby's own /profile prefs, which only the server parent has.
 */
export function RequestHelpButton({ slug, copy }: { slug: string; copy: RequestHelpButtonCopy }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!reason) return;
    startTransition(async () => {
      const result = await createHelpRequestAction(slug, reason, note || null);
      if (result.error) {
        setFeedback(result.error);
      } else {
        setFeedback(copy.notifiedAck);
        setOpen(false);
        setReason(null);
        setNote("");
      }
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 p-4">
      {open && (
        <div className="w-full max-w-sm rounded-card border border-border bg-background-elevated p-4 shadow-soft">
          <p className="mb-2 text-sm font-semibold">What&apos;s up?</p>
          <div className="flex flex-wrap gap-2">
            {/* text-on-accent when selected — bg-accent-pink is pastel in
                dark mode too, and the inherited --fg fails on it there. */}
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={`min-h-11 rounded-pill border px-3 py-1.5 text-sm ${
                  reason === r ? "border-focus-ring bg-accent-pink text-on-accent" : "border-border bg-background"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Something else" && (
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell us more…"
              className="mt-2"
              aria-label="Describe the problem"
            />
          )}
          <div className="mt-3 flex gap-2">
            <Button onClick={submit} disabled={!reason || isPending} size="sm">
              Send
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <p role="status" aria-live="polite" className="rounded-pill bg-background-elevated px-3 py-1 text-xs shadow-soft">
          {feedback}
        </p>
      )}

      <Button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-12 px-6 shadow-soft"
        variant={open ? "secondary" : "default"}
      >
        {copy.requestButtonLabel}
      </Button>
    </div>
  );
}
