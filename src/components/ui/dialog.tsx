"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal accessible modal — same from-scratch approach as tabs.tsx (no
 * external dependency for what's a small, well-understood surface): focus
 * trap while open, `Escape` and backdrop-click to close, focus restored to
 * whatever opened it on close. Controlled (`open`/`onClose`), not a
 * trigger+portal pattern — nothing else in this app renders through a
 * portal, and a `fixed` overlay works fine without one.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-card border border-border bg-background-elevated p-6 shadow-soft",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
