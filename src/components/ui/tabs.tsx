"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Minimal accessible tabs — WAI-ARIA tabs pattern (roving tabindex,
 * arrow-key navigation, `aria-selected`/`aria-controls`), styled from our
 * own tokens. No external dependency; the surface area here (switch
 * between a handful of panels) doesn't need one.
 */
export function Tabs({
  items,
  defaultTabId,
  label,
}: {
  items: TabItem[];
  defaultTabId?: string;
  label: string;
}) {
  const [active, setActive] = useState(defaultTabId ?? items[0]?.id);
  const baseId = useId();

  function focusTab(index: number) {
    const item = items[index];
    if (!item) return;
    setActive(item.id);
    document.getElementById(`${baseId}-tab-${item.id}`)?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab((index + 1) % items.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab((index - 1 + items.length) % items.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(items.length - 1);
    }
  }

  if (items.length === 0) return null;

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2 border-b-2 border-border pb-3">
        {items.map((item, i) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "min-h-11 rounded-pill px-4 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "bg-accent-pink text-on-accent"
                  : "border border-border bg-background-elevated text-foreground-muted hover:opacity-90",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={active !== item.id}
          className="pt-4"
        >
          {active === item.id && item.content}
        </div>
      ))}
    </div>
  );
}
