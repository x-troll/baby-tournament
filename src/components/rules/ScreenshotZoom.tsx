"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";

export interface ScreenshotZoomProps {
  src: string;
  caption: string;
  onClose: () => void;
}

/**
 * Full-screen zoomable/pinchable screenshot viewer. These are settings
 * screens with small text being read on a phone in a bar — a thumbnail
 * is useless, this is the whole point (spec).
 *
 * Pinch/drag is the primary interaction, but explicit +/-/reset buttons
 * are included too so this doesn't quietly become pinch-only — the
 * spec's drag-only exception (2.1.1 waived) is specifically for
 * *result-reporting reorder*, not this viewer.
 */
export function ScreenshotZoom({ src, caption, onClose }: ScreenshotZoomProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = "screenshot-zoom-caption";

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <div className="flex items-center justify-between gap-4 p-3">
        <p id={dialogTitleId} className="truncate text-sm text-white">
          {caption}
        </p>
        <Button ref={closeButtonRef} variant="secondary" size="sm" onClick={onClose}>
          ✕ Close
        </Button>
      </div>

      <TransformWrapper doubleClick={{ mode: "toggle" }} wheel={{ step: 0.2 }}>
        <ZoomControls />
        <TransformComponent wrapperClass="!w-full !flex-1" contentClass="!h-full !w-full">
          <div className="relative h-full w-full">
            <Image src={src} alt={caption} fill sizes="100vw" className="object-contain" priority />
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="flex justify-center gap-2 pb-2">
      <Button variant="secondary" size="sm" onClick={() => zoomOut()} aria-label="Zoom out">
        −
      </Button>
      <Button variant="secondary" size="sm" onClick={() => resetTransform()} aria-label="Reset zoom">
        Reset
      </Button>
      <Button variant="secondary" size="sm" onClick={() => zoomIn()} aria-label="Zoom in">
        +
      </Button>
    </div>
  );
}
