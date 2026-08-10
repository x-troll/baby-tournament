import { describe, expect, it } from "vitest";
import { Game } from "@/generated/prisma/enums";
import { loadAllRules, loadRules, validateAllRulesFiles, validateRulesFileSync } from "@/lib/rules-content";

describe("validateRulesFileSync — the committed content/rules/*.md files", () => {
  it("has no errors for either game (regression guard on the real committed files)", () => {
    for (const game of Object.values(Game)) {
      const result = validateRulesFileSync(game);
      expect(result.errors, `${game}: ${result.errors.join("; ")}`).toEqual([]);
    }
  });

  it("validateAllRulesFiles covers exactly the two games in the Game enum", () => {
    const results = validateAllRulesFiles();
    expect(results.map((r) => r.game).sort()).toEqual([Game.MARIO_KART, Game.SUPER_SMASH].sort());
  });
});

describe("loadRules — parse + sanitize + render", () => {
  it("loads Mario Kart rules with the expected summary and no client-visible raw markdown", async () => {
    const rules = await loadRules(Game.MARIO_KART);
    expect(rules.summary).toBe("No items · Random map · 150cc");
    expect(rules.bodyHtml).toContain("<h1>"); // rendered, not raw "# Mario Kart..."
    expect(rules.bodyHtml).not.toContain("# Mario Kart");
  });

  it("loads Super Smash rules with the expected summary", async () => {
    const rules = await loadRules(Game.SUPER_SMASH);
    expect(rules.summary).toBe("1v1 · Stock · Final Destination");
  });

  it("includes the committed placeholder screenshot with its caption", async () => {
    const rules = await loadRules(Game.MARIO_KART);
    expect(rules.screenshots).toHaveLength(1);
    expect(rules.screenshots[0]!.src).toBe("/rules/mario-kart/settings-placeholder.png");
  });

  it("loadAllRules returns both games keyed by the Game enum", async () => {
    const all = await loadAllRules();
    expect(Object.keys(all).sort()).toEqual([Game.MARIO_KART, Game.SUPER_SMASH].sort());
    expect(all[Game.MARIO_KART].game).toBe(Game.MARIO_KART);
  });

  it("sanitizes rendered HTML — a script tag injected into markdown never survives to bodyHtml", async () => {
    // Exercises the rehype-sanitize pass directly rather than mutating a
    // committed file: markdown allows raw HTML passthrough by default,
    // and remark-rehype only turns it into an (unsafe) raw HTML node —
    // sanitize is what actually strips it, so this is worth pinning down.
    const { unified } = await import("unified");
    const remarkParse = (await import("remark-parse")).default;
    const remarkRehype = (await import("remark-rehype")).default;
    const rehypeSanitize = (await import("rehype-sanitize")).default;
    const rehypeStringify = (await import("rehype-stringify")).default;

    const file = await unified()
      .use(remarkParse)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process("Hello <script>alert(1)</script>");

    expect(String(file)).not.toContain("<script>");
  });
});
