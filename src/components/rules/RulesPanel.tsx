"use client";

import { useState } from "react";
import Image from "next/image";
import { ScreenshotZoom } from "./ScreenshotZoom";

export interface RulesPanelScreenshot {
  src: string;
  caption: string;
}

export interface RulesPanelProps {
  id: string;
  bodyHtml: string;
  screenshots: RulesPanelScreenshot[];
  /** Optional tonight-only free-text note, rendered above the game rules, clearly marked as a tonight-only change. */
  overrideNote?: string | null;
}

export function RulesPanel({ id, bodyHtml, screenshots, overrideNote }: RulesPanelProps) {
  const [zoomed, setZoomed] = useState<RulesPanelScreenshot | null>(null);

  return (
    <div id={id} className="mt-2 rounded-card border border-border bg-background-elevated p-4 shadow-soft">
      {/* text-on-accent throughout, not text-active/inherited text-foreground
          — bg-accent-yellow is pastel in dark mode too, and both --active
          and the inherited --fg fail contrast on it there. */}
      {overrideNote && (
        <div className="mb-4 rounded-card border border-active bg-accent-yellow px-3 py-2 text-on-accent">
          <p className="text-xs font-bold uppercase tracking-wide">Tonight only</p>
          <p className="text-sm">{overrideNote}</p>
        </div>
      )}

      {/* bodyHtml comes exclusively from src/lib/rules-content.ts, which
          sanitizes it server-side via rehype-sanitize — safe to render
          directly, and there is no client-side markdown parser anywhere
          in this app. */}
      <div
        className="prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {screenshots.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground-muted">Settings screenshots</h4>
          <ul className="flex flex-wrap gap-3">
            {screenshots.map((shot) => (
              <li key={shot.src} className="w-40">
                <button
                  type="button"
                  onClick={() => setZoomed(shot)}
                  className="block min-h-11 w-full overflow-hidden rounded-card border border-border"
                  aria-label={`Zoom in on screenshot: ${shot.caption}`}
                >
                  <Image
                    src={shot.src}
                    alt={shot.caption}
                    width={320}
                    height={180}
                    className="h-auto w-full object-cover"
                  />
                </button>
                <p className="mt-1 text-xs text-foreground-muted">{shot.caption}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {zoomed && <ScreenshotZoom src={zoomed.src} caption={zoomed.caption} onClose={() => setZoomed(null)} />}
    </div>
  );
}
