"use client";

import { useSyncExternalStore } from "react";
import type { Game } from "@/generated/prisma/enums";

// Shared with RulesBar.tsx (which owns the actual toggle button/panel) —
// factored out so a sibling element (StatusCard's "click to see full
// rulesets" caption) can read the same expanded/collapsed state without
// RulesBar needing to expose a callback prop or lift its state up.
export function rulesStorageKey(game: Game, instanceId?: string): string {
  return `playtime-rules-expanded-${game}${instanceId ? `-${instanceId}` : ""}`;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("playtime-rules-toggle", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("playtime-rules-toggle", onStoreChange);
  };
}

/** Read-only mirror of RulesBar's own expand/collapse state. */
export function useRulesExpanded(game: Game, instanceId?: string, initialExpanded?: boolean): boolean {
  const key = rulesStorageKey(game, instanceId);

  const getSnapshot = () => {
    const stored = window.localStorage.getItem(key);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return initialExpanded ?? false;
  };
  const getServerSnapshot = () => initialExpanded ?? false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
