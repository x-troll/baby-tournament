import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseSlugNumber } from "@/lib/slug-number";
import { computeSpectatorState } from "@/lib/spectator-state";
import { loadRules } from "@/lib/rules-content";
import { SpectatorPoller } from "@/components/spectator/SpectatorPoller";
import { RulesFooter } from "@/components/spectator/RulesFooter";

// Projectors wash out dusty pastels badly (spec) — the spectator screen
// defaults to dark regardless of the room's system/localStorage
// preference, via an inline script (same no-flash pattern as
// layout.tsx's theme script) so there's no flash of the light skin
// before JS runs. Doesn't touch localStorage, so leaving this page
// doesn't change anyone's saved preference elsewhere in the app.
const FORCE_DARK_SCRIPT = `document.documentElement.setAttribute("data-mode", "dark");`;

export default async function SpectatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugNumber = parseSlugNumber(slug);
  if (slugNumber === null) notFound();

  const playtime = await prisma.playtime.findUnique({ where: { slugNumber } });
  if (!playtime) notFound();

  const [state, rules] = await Promise.all([computeSpectatorState(slug), loadRules(playtime.game)]);
  if (!state) notFound();

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FORCE_DARK_SCRIPT }} />
      <main className="min-h-screen pb-20">
        <SpectatorPoller slug={slug} initial={state} />
        <div className="fixed inset-x-0 bottom-0 p-4">
          <RulesFooter summary={rules.summary} overrideNote={playtime.rulesOverrideNote} />
        </div>
      </main>
    </>
  );
}
