"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary — the app-wide safety net for the routine business-
 * rule throws scattered across server actions (e.g. "This match has
 * already been confirmed", surfaced by the double-confirm race two
 * participants tapping "gold star" at once can trigger). Without this,
 * any of those crash to Next's default unstyled overlay — jarring on the
 * "nursery" skin generally, and a genuine dead end on the unauthenticated
 * spectator screen, where nobody's at the keyboard to dismiss it.
 *
 * Segment-specific error.tsx files would be more targeted (different
 * copy for the baby page vs. the spectator screen), but this one root
 * boundary already turns every uncaught throw into a recoverable "try
 * again" instead of a crash — the highest-value single fix here.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl">😵</p>
      <h1 className="text-xl font-bold">Something went wrong.</h1>
      <p className="max-w-sm text-sm text-foreground-muted">
        {error.message || "An unexpected error happened. It's been logged."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Go home
        </Button>
      </div>
    </main>
  );
}
