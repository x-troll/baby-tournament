// Runs as `prebuild` (see package.json) so this fires identically on
// `npm run build` locally, in CI, and on Heroku's build phase (before the
// `release` phase even starts) — a broken rules file rejects the deploy
// and the previous release stays live, per PLAN.md.
import { validateAllRulesFiles } from "../src/lib/rules-content";

const results = validateAllRulesFiles();
const failed = results.filter((r) => r.errors.length > 0);

for (const result of results) {
  if (result.errors.length === 0) {
    console.log(`✓ ${result.game}: ${result.filePath}`);
  } else {
    console.error(`✗ ${result.game}: ${result.filePath}`);
    for (const error of result.errors) {
      console.error(`    - ${error}`);
    }
  }
}

if (failed.length > 0) {
  console.error(
    `\n${failed.length} of ${results.length} game(s) failed rules-content validation. Fix content/rules/*.md before building.`,
  );
  process.exit(1);
}

console.log(`\nAll ${results.length} rules files valid.`);
