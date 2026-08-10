"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-runs the current route's Server Components so state
 * changes made elsewhere (another baby confirming, an admin resolving a
 * dispute) show up without a manual reload. A deliberately light touch
 * for Phase 5 — Phase 7 builds a proper shared event-cursor poll
 * (`/api/playtime/[slug]/state`) for the spectator screen, which has
 * different needs (unauthenticated, many simultaneous viewers, higher
 * frequency); this baby-page version doesn't need to anticipate that.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
