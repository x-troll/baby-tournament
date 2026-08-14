"use client";

import { createContext, useContext } from "react";

/**
 * Ambient shrink factor applied by the nearest enclosing
 * FitToViewportStage (src/components/spectator/FitToViewportStage.tsx),
 * `1` (no-op) outside of one. A small neutral module rather than living
 * inside FitToViewportStage itself so a component that isn't otherwise
 * spectator-specific (PlaytimeBracketsView, shared with the admin panel
 * and a baby's own page) doesn't have to import from the spectator/
 * folder just to read this.
 */
const FitScaleContext = createContext(1);

export const FitScaleProvider = FitScaleContext.Provider;

export function useFitScale(): number {
  return useContext(FitScaleContext);
}
