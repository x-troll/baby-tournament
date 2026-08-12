import { Avatar } from "@/components/ui/Avatar";

/** "Small discreet indicator" per spec — not alarming, just present when it matters. */
export function HelpIndicator({ count, adminTerm }: { count: number; adminTerm: string }) {
  if (count === 0) return null;
  // text-on-accent, not the inherited ambient text color — bg-accent-yellow
  // is pastel in dark mode too (and /live forces dark), so the default
  // light --fg text would fail contrast on it.
  return (
    <div
      role="status"
      className="fixed right-4 top-4 flex items-center gap-2 rounded-pill border border-active bg-accent-yellow py-1 pl-1 pr-3 text-sm font-semibold text-on-accent shadow-soft"
    >
      <Avatar src="/admin-avatar.svg" size={42} />
      🆘 {count} baby{count === 1 ? "" : "ies"} need{count === 1 ? "s" : ""} a {adminTerm}
    </div>
  );
}
