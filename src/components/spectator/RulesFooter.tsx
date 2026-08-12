/** A permanent one-line strip, not the expandable RulesBar — readable from across the room, nothing to tap. */
export function RulesFooter({ summary, overrideNote }: { summary: string; overrideNote: string | null }) {
  return (
    <div className="rounded-pill border border-border bg-background-elevated px-4 py-2 text-center text-lg">
      📋 {summary}
      {overrideNote && <span className="ml-2 font-semibold text-active">Tonight only: {overrideNote}</span>}
    </div>
  );
}
