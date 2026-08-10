"use client";

import { useSyncExternalStore } from "react";
import type { Game } from "@/generated/prisma/enums";
import { RulesPanel, type RulesPanelScreenshot } from "./RulesPanel";

export interface RulesBarProps {
  game: Game;
  summary: string;
  bodyHtml: string;
  screenshots: RulesPanelScreenshot[];
  overrideNote?: string | null;
  /**
   * Suggested initial state for a first-ever visit on this device, before
   * any localStorage preference exists — e.g. the check-in page wants
   * this expanded by default. Once the player toggles it, their choice
   * persists and wins from then on ("doesn't fight the player").
   */
  initialExpanded?: boolean;
  /**
   * Disambiguates the DOM id and localStorage key when more than one
   * RulesBar for the *same* game renders on one page at once (e.g. a
   * style-guide preview). Independent bars for the same game in normal
   * use (different pages) don't need this — they share state on purpose.
   */
  instanceId?: string;
}

function storageKey(game: Game, instanceId?: string): string {
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

/**
 * Persistent, compact rules bar — the one-line summary, always visible,
 * never behind a menu. Tapping it expands a collapsible accordion panel.
 * Expand/collapse state persists in localStorage via useSyncExternalStore
 * (not useEffect+setState — see PLAN.md Phase 2 note on why that pattern
 * causes a hydration-mismatch risk here).
 */
export function RulesBar({
  game,
  summary,
  bodyHtml,
  screenshots,
  overrideNote,
  initialExpanded,
  instanceId,
}: RulesBarProps) {
  const key = storageKey(game, instanceId);
  const panelId = `rules-panel-${game}${instanceId ? `-${instanceId}` : ""}`;

  const getSnapshot = () => {
    const stored = window.localStorage.getItem(key);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return initialExpanded ?? false;
  };
  const getServerSnapshot = () => initialExpanded ?? false;

  const expanded = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !expanded;
    window.localStorage.setItem(key, String(next));
    window.dispatchEvent(new Event("playtime-rules-toggle"));
  }

  return (
    <div className="w-full">
      {/* text-on-accent, not text-foreground — --accent-blue is pastel in
          dark mode too, and --fg (light in dark mode) fails contrast on
          it. See src/components/ui/button.tsx for the same fix. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-pill border border-border bg-accent-blue px-4 py-2 text-left text-sm font-semibold text-on-accent shadow-soft"
      >
        <span className="truncate">📋 {summary}</span>
        <span
          aria-hidden
          className="shrink-0 transition-transform motion-reduce:transition-none"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        >
          ⌄
        </span>
      </button>

      {expanded && (
        <RulesPanel id={panelId} bodyHtml={bodyHtml} screenshots={screenshots} overrideNote={overrideNote} />
      )}
    </div>
  );
}
