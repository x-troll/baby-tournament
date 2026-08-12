import { Game } from "@/generated/prisma/enums";
import { loadAllRules } from "@/lib/rules-content";
import { RulesBar } from "@/components/rules/RulesBar";

// Server Component: markdown parsing/rendering happens exclusively here
// (src/lib/rules-content.ts), never shipped to the client as a bundle.
// If content/rules/*.md is broken, loadAllRules() throws and this page
// (and `next build`, via scripts/validate-rules-content.ts) fails loudly
// instead of silently rendering blank rules at the bar.
export default async function RulesPreviewPage() {
  const rules = await loadAllRules();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Rules content pipeline preview</h1>
        <p className="text-sm text-foreground-muted">
          Phase 3, parsed from content/rules/*.md, rendered server-side, sanitized. Tap a bar to expand, tap a
          screenshot to zoom.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{Game.MARIO_KART}</h2>
        <RulesBar
          game={Game.MARIO_KART}
          summary={rules[Game.MARIO_KART].summary}
          bodyHtml={rules[Game.MARIO_KART].bodyHtml}
          screenshots={rules[Game.MARIO_KART].screenshots}
          overrideNote="3 races per match tonight, not 1, we've got time."
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{Game.SUPER_SMASH}</h2>
        <RulesBar
          game={Game.SUPER_SMASH}
          summary={rules[Game.SUPER_SMASH].summary}
          bodyHtml={rules[Game.SUPER_SMASH].bodyHtml}
          screenshots={rules[Game.SUPER_SMASH].screenshots}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Expanded by default (e.g. check-in page usage)</h2>
        <RulesBar
          game={Game.MARIO_KART}
          instanceId="check-in-demo"
          summary={rules[Game.MARIO_KART].summary}
          bodyHtml={rules[Game.MARIO_KART].bodyHtml}
          screenshots={rules[Game.MARIO_KART].screenshots}
          initialExpanded
        />
      </section>
    </main>
  );
}
