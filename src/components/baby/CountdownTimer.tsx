"use client";

import { useEffect, useRef, useState } from "react";

const ANNOUNCE_THRESHOLDS = [30, 10, 5];

function secondsUntil(deadline: Date): number {
  return Math.max(0, Math.round((deadline.getTime() - Date.now()) / 1000));
}

/**
 * The 60s auto-confirm timer — deliberately not extendable/pausable
 * (spec waives WCAG 2.2.1 for exactly this control) but must stay
 * visible and counting down. The visible number updates every second;
 * a *separate* aria-live region only announces at meaningful thresholds
 * (30s/10s/5s/done) rather than every tick, per the spec's explicit
 * "do not announce the timer every second" instruction.
 */
export function CountdownTimer({ deadline, doneLabel }: { deadline: Date; doneLabel: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadline));
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(new Set<number>());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = secondsUntil(deadline);
      setSecondsLeft(remaining);

      for (const threshold of ANNOUNCE_THRESHOLDS) {
        if (remaining <= threshold && !announced.current.has(threshold)) {
          announced.current.add(threshold);
          setAnnouncement(`${threshold} seconds left`);
        }
      }
      if (remaining === 0 && !announced.current.has(0)) {
        announced.current.add(0);
        setAnnouncement(doneLabel);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, doneLabel]);

  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="font-display text-3xl font-bold tabular-nums text-active">
        {secondsLeft}s
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
