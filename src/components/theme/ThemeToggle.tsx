"use client";

import { useEffect, useSyncExternalStore } from "react";

type Mode = "light" | "dark";

const STORAGE_KEY = "playtime-theme-mode";

function getSnapshot(): Mode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// SSR has no localStorage/matchMedia to read — mirrors the no-flash
// script's inline default (system dark, otherwise light) closely enough
// that hydration doesn't visibly flash; useSyncExternalStore reconciles
// to the real client value immediately after mount regardless.
function getServerSnapshot(): Mode {
  return "light";
}

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onStoreChange);
  media.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}

/**
 * Manual light/dark override, persisted to localStorage — layered on top
 * of `prefers-color-scheme`, which tokens.css follows by default. The
 * no-flash script in layout.tsx applies any stored choice before first
 * paint; this component reads the same source of truth via
 * useSyncExternalStore (no setState-in-effect) and keeps the DOM
 * attribute in sync when the user actively toggles it.
 */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
  }, [mode]);

  const next: Mode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        localStorage.setItem(STORAGE_KEY, next);
        // Storage events don't fire in the tab that wrote them, so nudge
        // this tab's subscribers directly.
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      }}
      className="min-h-11 min-w-11 rounded-full border border-border bg-background-elevated px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition-colors hover:opacity-90"
      aria-label={`Switch to ${next} mode`}
    >
      {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
