import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".out");
const fixtures = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "fixtures.json"), "utf8")) as {
  playtimeId: string;
  playtimeSlug: string;
};
const adminStorageState = path.join(OUT_DIR, "admin-storage-state.json");
const babyStorageState = path.join(OUT_DIR, "baby-storage-state.json");

/**
 * WCAG 2.2 AA, per the spec, with exactly two deliberate exceptions:
 * drag-to-reorder result entry (2.1.1, drag-only, no keyboard
 * alternative) and the 60s auto-confirm timer (2.2.1, not
 * pausable/extendable — that's the mechanic that makes the event run
 * without a Daddy). Axe-core's automated rules don't actually have
 * direct equivalents for either criterion — 2.1.1 and 2.2.1 are
 * fundamentally behavioral/temporal and need a manual check, not a
 * static DOM scan — so there is nothing to `.disableRules()` for them in
 * practice. If a specific axe rule ever does fire against either
 * control, add a targeted exclude here with a comment, rather than
 * silencing it broadly.
 */
async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const COLOR_SCHEMES = ["light", "dark"] as const;

for (const scheme of COLOR_SCHEMES) {
  test.describe(`color-scheme: ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test("admin login (public)", async ({ page }) => {
      await page.goto("/admin/login");
      await expectNoA11yViolations(page);
    });

    test("rules-preview (public)", async ({ page }) => {
      await page.goto("/rules-preview");
      await expectNoA11yViolations(page);
    });

    test("style-guide (public)", async ({ page }) => {
      await page.goto("/style-guide");
      await expectNoA11yViolations(page);
    });

    test.describe("as admin", () => {
      test.use({ storageState: adminStorageState });

      test("admin dashboard", async ({ page }) => {
        await page.goto("/admin");
        await expectNoA11yViolations(page);
      });

      test("playtime detail (star chart, match reporting)", async ({ page }) => {
        await page.goto(`/admin/playtimes/${fixtures.playtimeId}`);
        await expectNoA11yViolations(page);
      });

      test("help requests inbox", async ({ page }) => {
        await page.goto("/admin/help-requests");
        await expectNoA11yViolations(page);
      });

      test("admin profile", async ({ page }) => {
        await page.goto("/admin/profile");
        await expectNoA11yViolations(page);
      });
    });

    test.describe("as baby", () => {
      test.use({ storageState: babyStorageState });

      test("baby play screen (status card, star chart, rules bar, help button)", async ({ page }) => {
        await page.goto(`/play/${fixtures.playtimeSlug}`);
        await expectNoA11yViolations(page);
      });
    });
  });
}

// The spectator screen forces dark mode regardless of system preference
// (by design — projectors wash out light pastels) so it only needs
// checking once, not parametrized over both color schemes.
test("spectator screen (public, forced dark)", async ({ page }) => {
  await page.goto(`/live/${fixtures.playtimeSlug}`);
  await expectNoA11yViolations(page);
});
