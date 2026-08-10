import { defineConfig, devices } from "@playwright/test";

// Only the a11y suite lives under Playwright right now — the rest of the
// project's verification happens via Vitest (bracket engine, pure) plus
// the one-off scripts used during each phase's build (deleted after use;
// see PLAN.md). Skin (nursery/plain) is a server-startup-time env var,
// not a runtime toggle, so covering all 4 theme combinations means
// running this suite twice — once per skin — which is what the CI
// workflow's matrix does (see .github/workflows/ci.yml). Locally this
// just runs against whatever THEME your dev server already has.
export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: false, // shares one dev server + seeded DB state across the whole run
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/a11y/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
