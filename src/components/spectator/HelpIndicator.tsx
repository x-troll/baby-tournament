/** "Small discreet indicator" per spec — not alarming, just present when it matters. */
export function HelpIndicator({ count }: { count: number }) {
  if (count === 0) return null;
  // text-on-accent, not the inherited ambient text color — bg-accent-yellow
  // is pastel in dark mode too (and /live forces dark), so the default
  // light --fg text would fail contrast on it.
  return (
    <div
      role="status"
      className="fixed right-4 top-4 rounded-pill border border-active bg-accent-yellow px-3 py-1 text-sm font-semibold text-on-accent shadow-soft"
    >
      🆘 {count} baby{count === 1 ? "" : "ies"} need{count === 1 ? "s" : ""} a Daddy
    </div>
  );
}
