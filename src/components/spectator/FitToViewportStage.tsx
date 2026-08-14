"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FitScaleProvider } from "@/components/ui/fit-scale-context";

/**
 * Shrinks its children to fit the viewport's height, never scrolls
 * vertically — built for the unauthenticated /playtimes/[slug] spectator
 * screen (a projector/TV display nobody's meant to touch, see
 * PlaytimeDetailPage's PublicSpectatorBranch), where the content varies a
 * lot by stage (a handful of check-in badges vs. a multi-round bracket) and
 * by event size, so a fixed layout can't be pre-tuned to always fit.
 *
 * Deliberately a uniform CSS `transform: scale()`, not a real layout
 * resize (smaller fonts/paddings/gaps) — that would mean re-tuning every
 * size-related class in every descendant. The one thing that costs is
 * getBoundingClientRect()-based measurement inside the scaled subtree
 * coming back already-shrunk — see useFitScale()'s consumer for how that's
 * compensated for.
 */
export function FitToViewportStage({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    function recompute() {
      if (!outer || !inner) return;
      // Reset before measuring — inner.scrollHeight while already scaled
      // down would report a shrunk height, feeding back into the ratio and
      // compounding on every pass instead of converging on the real
      // natural-size fit.
      inner.style.transform = "scale(1)";
      const availableHeight = outer.clientHeight;
      const naturalHeight = inner.scrollHeight;
      const next = naturalHeight > 0 ? Math.min(1, availableHeight / naturalHeight) : 1;
      inner.style.transform = `scale(${next})`;
      setScale(next);
    }

    recompute();

    // Re-fits on every live poll update (a new match card, more babies
    // checked in, another bracket round appearing) as well as window
    // resizes — ResizeObserver on the inner (natural-size) content covers
    // both, since a resize also changes how much the natural content wraps
    // and thus its natural height.
    const ro = new ResizeObserver(recompute);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="flex h-dvh w-full justify-center overflow-hidden">
      <div ref={innerRef} className="h-fit origin-top">
        <FitScaleProvider value={scale}>{children}</FitScaleProvider>
      </div>
    </div>
  );
}
