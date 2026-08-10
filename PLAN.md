# Playtime — implementation plan & progress

Living tracker, updated at the end of every phase. Full rationale for each
decision lives in the original plan (`tournament-app-prompt.md` is the
source spec; the phase breakdown and key decisions below are the working
summary). **We stop after every phase for review — do not start the next
phase without an explicit go-ahead.**

## Decisions carried from planning (see chat history for full rationale)

- Admin auth: hand-rolled credentials + `jose`-signed session cookie (not
  NextAuth) — NextAuth v5/Auth.js is still in beta as of this build, and a
  hand-rolled version reuses the same session mechanism as baby auth
  instead of adding a whole framework dependency for one login form.
- Live updates: polling (not SSE) — Heroku router kills idle connections
  after 55s, dyno restarts drop long-lived connections anyway. Made cheap
  via an event-cursor over the append-only `MatchEvent` log.
- Timers (auto-confirm, forfeit clock): lazily computed from a stored
  `deadlineAt`, not a scheduled job — no worker process, no Redis. See
  `state-machine.ts` header comment.
- Prisma 7 requires an explicit driver adapter (`@prisma/adapter-pg`) —
  the `datasource.url` used to live in `schema.prisma`; now it lives in
  `prisma.config.ts` (CLI-only) and the app's own client in
  `src/lib/prisma.ts` constructs the adapter from `DATABASE_URL` at
  runtime.
- TypeScript pinned to 5.9.3, ESLint to 9.x — `typescript-eslint` doesn't
  support TS 7.0 yet and `eslint-plugin-jsx-a11y` doesn't support ESLint
  10 yet. Revisit these pins as the ecosystem catches up.
- Full decision log (auth, SSE-vs-poll, markdown renderer, package
  manager, drag/zoom libraries, QR, CI/CD, station scheduling, admin
  Telegram linking) is in the approved plan from the planning session.

## Gaps & gotchas found during planning

1. Admin Telegram linking isn't specified by the spec — resolved with a
   personal `/start <adminLinkToken>` deep link per Daddy (Phase 4).
2. N=3 at start: "skip brackets entirely" = skip the *whole* tournament,
   round-robin decides final placement directly, no Phase 2.
3. Pen shrinkage from no-shows below 3 (not covered by spec): resolved as
   auto-advance-both at 2, bye at 1 — see `resolvePenAfterNoShows`.
4. Head-to-head tiebreak is undefined when tied babies never played each
   other — falls through to random in that case.
5. QF1 and QF2 must both complete before anything else in Phase 2 — only
   real parallelism opportunity if stations > 1.

---

## Phase 1 — Bootstrap, schema, bracket engine, tests ✅ DONE

- [x] Next.js 16 (App Router, TS) project bootstrap, npm, Tailwind v4 wired
      (minimal — real tokens in Phase 2)
- [x] `prisma/schema.prisma` — unified `Match`/`MatchParticipant` model,
      append-only `MatchEvent` log, `Admin`/`Playtime`/`Baby`/`HelpRequest`
- [x] `prisma.config.ts` + `src/lib/prisma.ts` (Prisma 7 driver-adapter
      pattern, `@prisma/adapter-pg`)
- [x] Initial migration applied to local dev Postgres (`playtime` db,
      via Homebrew `postgresql@18` — started for this session, see note)
- [x] `src/lib/bracket-engine/` — pure TypeScript, zero DB/React/copy deps:
      - `pens.ts` — `computeRoundLayout`, `solveFourThreeSplit`,
        `assignBabiesToPens` (snake draw), `computeByeRoundAssignment`,
        `resolvePenAfterNoShows`
      - `tiebreak.ts` — shared score → head-to-head → random chain
      - `seeding.ts` — the "beaten count" score formula
      - `round-robin.ts` — N=3 start-only special case
      - `phase2.ts` — the fixed 6-match DAG, no bracket reset
      - `state-machine.ts` — match lifecycle + lazy deadline resolution
- [x] `tests/bracket-engine/*.test.ts` — **111 tests, all green**:
      N=6..40 solver vs. an independently-computed table, N=3/N=5 start
      special cases, even-survivor invariant simulated for every starting
      N from 6–200, seeding score + 2-way/3-way tiebreaks, round-robin
      standings incl. cyclic tie, full 64-path Phase 2 matrix, state
      machine transitions + lazy auto-confirm
- [x] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
      all pass clean

**Note for you:** I started a local Postgres (`brew services start
postgresql@18`) to run and verify the migration — stop it with `brew
services stop postgresql@18` if you don't want it running, or leave it for
continued local dev.

**Learned, relevant to later phases:**
- Prisma 7's driver-adapter requirement is a real shape change from what
  most Prisma tutorials still show — worth knowing before Phase 4's
  server actions.
- The N=3 round-robin case can *only* produce a fully transitive result
  (0/1/2 wins, no ties) or a fully cyclic 3-way tie (1/1/1) — never a
  clean 2-way tie. Confirmed via the test suite; doesn't change anything
  in the plan, just a fact worth knowing about that mode.

## Phase 2 — Design system and theme tokens ✅ DONE

- [x] `src/styles/tokens.css` — CSS custom properties, all 4 combinations
      (light/dark × nursery/plain) on two orthogonal `<html>` attributes:
      `data-mode` (light/dark, system + localStorage override) and
      `data-skin` (nursery/plain, from `THEME` env, baked in server-side)
- [x] Every color pair contrast-checked against WCAG 2.2 AA *before*
      committing (script-verified, not eyeballed) — gold-on-cream and
      dusty-pastel-on-indigo were the flagged risks and both needed
      iteration (darkened gold text, darkened/lightened borders to hit
      3:1) before they passed
- [x] `src/lib/terminology.ts` — single source for every nursery term;
      also swaps to neutral wording under `THEME=plain`, not just colors,
      since the point of the plain skin is screenshots without the ABDL
      framing
- [x] `src/lib/theme/motifs.ts` + `public/motifs/{light,dark}/*.svg` —
      swapped via the same CSS-variable mechanism as colors
      (`--motif-primary`/`--motif-secondary`), plus a typed registry for
      spots needing an actual `<Image>` element
- [x] Fredoka (display) + Nunito (body) via `next/font/google`, wired as
      CSS variables consumed by tokens.css
- [x] Tailwind v4 `@theme inline` mapping so tokens are usable as
      ordinary utilities (`bg-background`, `text-star-gold`, etc.)
- [x] `ThemeToggle` — manual light/dark override, localStorage-backed,
      no-flash inline script in `layout.tsx`, `useSyncExternalStore` on
      the client (not setState-in-effect — the stricter React Compiler
      lint in `eslint-plugin-react-hooks` v7 caught the naive version)
- [x] `src/components/ui/{button,card}.tsx` — shadcn/ui-style primitives
      (cva + `cn()` helper), hand-authored rather than via the shadcn CLI
      (see note below), pill-radius by default per the visual direction,
      44px touch targets
- [x] `src/app/page.tsx` — living style-guide/demo page exercising all of
      the above (terminology, swatches, motifs, buttons, toggle)
- [x] Verified: `typecheck`/`lint`/`test`/`build` all clean; dev server
      smoke-tested for both `data-skin="nursery"` (default) and
      `THEME=plain` → `data-skin="plain"`

**Learned, relevant to later phases:**
- Skipped the shadcn CLI (`shadcn init`) — it wants to own
  `globals.css`/component conventions and risked clobbering the
  already-built Tailwind v4 token system. Hand-authoring primitives in
  `src/components/ui/` following the same conventions (cva variants, the
  `cn()` helper) gets the same result without that risk. Fine to add more
  primitives the same way as later phases need them (Accordion for the
  rules panel in Phase 3, Dialog for the help-request sheet in Phase 5,
  etc.) rather than bulk-installing now.
- `eslint-plugin-react-hooks` v7 (pulled in transitively by
  `eslint-config-next`) actively flags `setState` inside a bare
  `useEffect` — the correct pattern for browser-only state (theme mode
  read from `localStorage`/`matchMedia`) is `useSyncExternalStore`, not an
  effect + state. Worth keeping in mind for the baby status-card polling
  in Phase 5 and the spectator poll in Phase 7 — those should probably
  use the same pattern rather than `useEffect` + `setState`.

## Phase 3 — Rules content pipeline ✅ DONE

- [x] `content/rules/{mario-kart,super-smash}.md` — real starter content,
      YAML frontmatter (`game`, `summary`, `screenshots`), placeholder
      body text for you to fill in before the event
- [x] One placeholder screenshot per game committed under
      `public/rules/<game>/settings-placeholder.png`, clearly captioned
      "PLACEHOLDER — replace with a real photo" — added so the pipeline
      (existence check, `next/image` rendering, zoom viewer) is actually
      exercised end-to-end rather than demoed with an empty array; swap
      for real captures before the event
- [x] `src/lib/rules-content.ts` — gray-matter + Zod frontmatter
      validation, remark→rehype→rehype-sanitize→rehype-stringify markdown
      rendering (server-only, no client markdown bundle anywhere),
      `validateRulesFileSync`/`validateAllRulesFiles` (collect-all-errors)
      and `loadRules`/`loadAllRules` (throw-on-error, for pages)
- [x] `scripts/validate-rules-content.ts` — real implementation now (was a
      Phase-1 placeholder stub), wired as the `prebuild` npm script;
      **verified it actually fails the build** by deliberately breaking a
      file (empty summary + missing screenshot) and confirming exit code 1
      before restoring
- [x] `src/components/rules/{RulesBar,RulesPanel,ScreenshotZoom}.tsx` —
      persistent pill bar → collapsible accordion → full-screen
      pinch/pan/zoom viewer (`react-zoom-pan-pinch`), plus explicit
      +/−/reset buttons so zoom isn't pinch-only
- [x] Optional per-playtime override note, rendered above the game rules
      inside the expanded panel with a "Tonight only" badge
- [x] Expand/collapse persists in localStorage via `useSyncExternalStore`
      (same pattern as the Phase 2 ThemeToggle) — supports multiple
      `RulesBar` instances for the same game on one page via an
      `instanceId` prop (caught a real duplicate-DOM-id/localStorage-key
      bug while building the demo page, fixed generally, not just patched
      for the demo)
- [x] `src/app/rules-preview/page.tsx` — Server Component demo proving
      the whole pipeline: real parsed content in, sanitized HTML out,
      three live `RulesBar` instances (including the check-in-page
      "expanded by default" case)
- [x] `tests/rules-content.test.ts` — regression guard on the real
      committed files, summary/HTML assertions, and a direct test that
      `rehype-sanitize` actually strips injected `<script>` content
- [x] Verified: typecheck/lint/test/build clean; dev server smoke-tested
      — correct distinct `aria-controls` ids and `aria-expanded` states
      across all three demo instances

**Learned, relevant to later phases:**
- Turbopack's build tracer can't follow the enum-keyed path lookup in
  `rulesFilePath()` and warns about tracing the whole project — harmless
  for our deploy (Heroku runs `next start` on the full slug, not
  `output: "standalone"`), resolved with documented `turbopackIgnore`
  comments rather than left as an unexplained warning.
- A stale Turbopack dev-server cache (`.next/`) failed to resolve a
  freshly-installed dependency (`@tailwindcss/typography`) even though
  `next build` found it fine — `rm -rf .next` fixed it. Worth remembering
  if a dev-only "can't resolve X" error shows up after `npm install` in
  later phases.
- The `RulesBar` instanceId fix is a real, reusable pattern — anything
  else keying off `useSyncExternalStore` + localStorage for
  multi-instance UI (e.g. per-match state cards in Phase 5) should
  consider the same disambiguation from the start.

## Phase 4 — Admin panel + playtime lifecycle ✅ DONE

This is the phase where the pure bracket engine actually got wired to the
database for the first time — by far the riskiest part of the whole app,
so it got the most verification (see below).

- [x] **Schema migration**: `MatchKind` enum changed from a generic `QF`
      to `QF1`/`QF2` (matching the engine's `Phase2MatchId` exactly, no
      translation layer), added a unique constraint on
      `[playtimeId, finalPlacement]`, added a proper `HelpRequest` ->
      `Playtime` relation. Applied via `prisma migrate deploy` against a
      hand-written SQL diff, not `migrate dev` — see note below.
- [x] `src/lib/auth.ts` — hand-rolled bcrypt + jose session cookie,
      `requireAdmin()`/`getCurrentAdmin()`; `scripts/ensure-admin-seed.ts`
      (idempotent — checks "does *any* admin exist", not email match, so
      it never resets a changed password on a later deploy)
- [x] `/admin/login` (public) + `/admin/(protected)/**` (route-group
      auth guard in a layout, not Next middleware — bcryptjs needs the
      Node runtime) — **verified with a real headless-browser run**
      (Playwright): unauthenticated redirect, wrong-password error,
      successful login, session persistence across navigation, logout
- [x] `src/lib/bracket-engine/placements.ts` — new pure engine function,
      `assignEliminatedPlacements`, deterministically turning a round's
      tied nappers into exact placement numbers (score, then
      registration-order tiebreak — never random, unlike seeding)
- [x] `src/lib/playtime-lifecycle.ts` — the DB-aware orchestration layer:
      `startPlaytime`, `confirmMatchResult` (the one code path for both
      pen and 1v1 results — admin override now, Phase 5 baby self-report
      later), round/Phase-2 completion cascades, the fixed-priority
      match scheduler, and a deliberately **scoped** `undoLastMatchResult`
      (see below)
- [x] Server actions (`src/server-actions/{auth,playtimes,matches,help-requests}.ts`)
      + admin pages: dashboard/create, playtime detail (nursery roster,
      join QR, lifecycle buttons, match list with admin-override result
      entry and undo), help-request inbox, admin profile (personal
      Telegram deep-link QR — the Gaps #1 fix)
- [x] `src/lib/qr.ts` — server-side SVG QR generation, no external service
- [x] **Verified against a real Postgres, not just typechecked**: a
      throwaway script played a full 6-baby tournament end-to-end
      (2×3-pen round 1 → 4 survivors → seeding → all 6 Phase-2 matches →
      Best Baby crowned, placements 1-6 all uniquely assigned), then
      separately exercised undo's edge cases, before being deleted

**A real bug the DB smoke test caught (not a hypothetical):** the first
version of `undoLastMatchResult` only blocked undo when a *new match* had
been created downstream. But confirming `LOSERS_R1` naps the 4th-place
baby immediately — *without* necessarily creating a new match yet (if
`WINNERS_FINAL` hasn't resolved). That confirmation would have been
undoable while leaving a napped baby with a placement number and no
matching confirmed result. Fixed by also blocking undo whenever any of
the match's own participants already has a non-ACTIVE status. Both the
bug and the fix are exercised by name in the verification script's
history — worth remembering that this class of bug (a side effect that
doesn't manifest as a new row) is exactly what's easy to miss without a
real end-to-end run.

**Known, deliberate limitation — not a bug:** `undoLastMatchResult` only
undoes the single most-recently-confirmed result in a playtime, and only
if nothing has cascaded from it yet (no new match created, no baby
status changed). If a result already advanced the round/Phase 2/the
whole tournament, undo is rejected with a clear message rather than
attempting to unwind the cascade. Full cascading undo — reverting a
confirmation *and* everything it triggered — is real, valuable future
work, deliberately out of scope here rather than attempted half-correct
under time pressure.

**Learned, relevant to later phases:**
- Prisma 7's `migrate dev` refuses to run at all in a non-interactive
  shell whenever it detects a potentially-destructive change (even
  against a schema, empty table) — and `migrate reset` has its own
  explicit AI-agent consent gate that stopped and asked before touching
  even a disposable local dev database. Worked around both by resetting
  once (with your consent) and then using `migrate diff --script` +
  hand-placing the migration file + `migrate deploy` (non-interactive by
  design) for the actual schema change — this is also exactly the
  command Phase 8's Heroku `release` phase will run, so it's a good
  rehearsal for that.
- `import "server-only"` unconditionally throws outside Next's build
  pipeline — it can't be used in any module a standalone script also
  needs to import (`auth.ts`, `playtime-lifecycle.ts`, `qr.ts` all lost
  it). The Phase 8 rehearsal-seed script will import
  `playtime-lifecycle.ts` directly, same as the throwaway verification
  script did here.
- A client component using `useActionState` cannot be exercised with raw
  `curl` — Next dispatches form actions through an internal RSC
  action-invocation protocol, not a plain HTML POST. A real browser
  (Playwright, now installed) is the only reliable way to verify a login
  flow like this end-to-end; worth reusing directly for the Phase 3/4/5/7
  axe-core a11y pass rather than installing anything new then.

## Phase 5 — Baby web UI + result reporting + help button ✅ DONE

- [x] **Lifecycle refactor**: `confirmMatchResult` (Phase 4) always went
      straight to CONFIRMED, which is right for admin override but wrong
      for baby self-report. Split into `reportMatchResult` (→ REPORTED +
      60s deadline), `confirmReportedMatch` (another baby, or the lazy
      auto-confirm check, finalizes it), `disputeMatch` (freezes it,
      creates a HelpRequest — literally reuses the admin inbox rather
      than a parallel notification path), and `ensureMatchNotExpired`
      (the lazy-deadline check, now actually wired to a real call site).
      All four share the same post-confirmation cascade `confirmMatchResult`
      already had. New `Match.disputed` boolean + migration.
- [x] `src/lib/baby-auth.ts` — same jose-signed-cookie pattern as admin
      auth, separate cookie namespace. Real entry point (Telegram magic
      link) is Phase 6; for now, admin's "Preview as baby" button
      (`previewAsBabyAction`) creates a session — a genuinely useful
      permanent feature for admin rehearsal, not a throwaway stand-in
- [x] `src/lib/baby-status.ts` — derives the 6 status-card states (+ an
      unavoidable 7th/8th: "playing now" needed a real READY→IN_PROGRESS
      transition to be distinct from "up next", and "awaiting your
      confirmation" needed to be distinguished from "waiting on
      playmates" depending on who reported) from live DB state, including
      ETA (`matches queued ahead × rolling average duration`, reusing the
      scheduler's exact priority order)
- [x] `src/components/baby/{StatusCard,CountdownTimer,ResultReportForm,StarChart,RequestHelpButton}.tsx`
      — drag-to-reorder via `@dnd-kit` for pens, two big buttons for 1v1;
      countdown timer announces only at 30s/10s/5s/done thresholds (not
      every second, per spec); star chart is a real `<table>`, own row
      highlighted, status never colour-only
- [x] `/play/[slug]` page + `AutoRefresh` (polls via `router.refresh()`
      every 5s — a light-touch stand-in for Phase 7's proper
      event-cursor endpoint, which has different needs: unauthenticated,
      many simultaneous viewers, higher frequency)
- [x] **Verified with a real two-browser-context Playwright run**, not
      just typecheck: full report → confirm cycle across two different
      baby sessions, the countdown timer actually ticking, the help
      button creating a request that shows up in the admin inbox

**Two real bugs the end-to-end testing caught (not hypothetical):**
1. `StatusCard`/`RequestHelpButton` are client components that were
   receiving the whole `Terminology` object as a prop — which carries
   functions (`eliminatedWithPlacement`, etc.), and functions can't cross
   the server/client boundary. Next threw at runtime, not at typecheck
   or build. Fixed by resolving to plain strings server-side before
   passing down. Worth remembering for any future client component that
   touches `terminology.ts`.
2. **Seeding for a playtime that starts with exactly 4 babies** (skips
   playpens entirely) was silently landing on **random** seed order:
   `startPhase2` always called `computeSeedingScore` with that playtime's
   pen-result history, which is *empty* in this case, so all 4 babies
   tied at score 0 and fell through to the engine's random tiebreak —
   not "seed by registration order if there's no history yet" as the
   spec requires, just an unannounced coin flip. Fixed by bypassing the
   scoring path entirely when pen history is empty and seeding by
   registration order directly, matching what `rankActiveBabyIds` already
   did for playpen assignment. This is exactly the kind of bug that a
   unit test wouldn't have caught (nothing in the Phase 1 test suite
   exercises `playtime-lifecycle.ts`'s DB-aware seeding call) — only
   surfaced because the browser test needed to know *which two babies*
   would be paired together.

**Known scope boundary, not a bug:** the baby page refreshes via a 5s
`router.refresh()` poll, not the shared event-cursor mechanism described
in the original plan. That's still coming in Phase 7 for the spectator
screen; nothing here blocks reusing it for the baby page too later if
5s feels too slow in rehearsal.

## Phase 6 — Telegram bot ✅ DONE

- [x] **Schema fix found while building the join flow**: `Baby.telegramChatId`
      had a bare global `@unique` — meaning the same Telegram account
      could never join a *second* playtime on a different night. Changed
      to `@@unique([playtimeId, telegramChatId])`. Verified directly: the
      same chat id joins two different playtimes as two distinct Baby rows.
- [x] `src/lib/telegram/client.ts` — thin hand-rolled fetch wrapper
      (sendMessage, sendPhoto, answerCallbackQuery, editMessageReplyMarkup,
      setWebhook/deleteWebhook). Gracefully no-ops (logs instead of
      sending) when `TELEGRAM_BOT_TOKEN` isn't set, and never throws on a
      failed send — verified a full tournament plays through correctly
      with zero bot token configured
- [x] `src/lib/telegram/copy.ts` — every bot message in one place, nursery
      voice, built from `terminology.ts`
- [x] Baby onboarding: `/start <joinToken>` → creates a pending Baby row
      (`displayName: null`, durable state, no in-memory session) → next
      plain-text message sets the name → magic-link sent. The Telegram
      bot **cannot set a cookie directly** (it's a separate connection
      hitting our webhook, not the baby's browser) — `createMagicLinkToken`/
      `verifyMagicLinkToken` (short-lived signed JWT) plus
      `GET /nursery/verify` exchange it for the real session cookie
- [x] Admin onboarding: `/start admin_<adminLinkToken>` links
      `Admin.telegramChatId` — the Gaps #1 fix from planning is now fully
      wired, not just a token sitting unused
- [x] `/status` and `/rules` commands
- [x] Inline-keyboard callbacks: Confirm/Dispute on a reported result
      (routes straight into `confirmReportedMatch`/`disputeMatch` — the
      same lifecycle functions the web UI calls, not a parallel path),
      On my way/Resolved on help requests
- [x] **Inline notification dispatch wired into `playtime-lifecycle.ts`**
      via a `NotificationCollector` threaded through the transaction:
      matches becoming READY ("it's your turn"), a result needing
      confirmation, a result confirmed, a baby napping (with placement),
      a baby crowned Best Baby — all fire *after* the transaction commits,
      never inside it (a push failing must never roll back a confirmed
      result)
- [x] Admin panel: "Register Telegram webhook" self-serve button
      (`setWebhook`, run once per environment, not per deploy)
- [x] **Verified against real Postgres**, not just typecheck: a script
      drove `handleUpdate()` through the full onboarding → play →
      dispute → resolve flow, including 401 checks on the raw webhook
      route (missing/wrong secret token) and the magic-link route's
      redirect/400 behavior over real HTTP

**A real bug caught while writing the verification script, not
hypothetical:** the Telegram "Resolved" button's first draft cleared
`Match.disputed = false` as a side effect of resolving the HelpRequest
thread. That would let the *original disputed report* silently
auto-confirm the next time anything read it past its deadline — exactly
the outcome a dispute exists to prevent, with nobody having corrected
anything. Fixed: "Resolved" now only closes the HelpRequest thread;
`disputed` only clears via an actual admin-panel override, which enters a
real corrected result. Verified both paths explicitly.

**Known gaps, not attempted this phase (documented, not silent):**
- **"On deck" (one match ahead) push** — the spec lists this as a
  distinct baby push trigger; only "it's your turn" (READY) is wired.
  Would need dedicated queue-position tracking beyond what ETA
  calculation already does; deferred as a clear, scoped addition rather
  than done half-right under time pressure.
- **Round-completion broadcast to Daddies** and **forfeit-clock pushes**
  are both spec-mentioned admin/baby notifications not implemented here
  — the forfeit clock itself (5-minute countdown, auto-forfeit) isn't
  built at all yet, in any phase; it belongs with "Handling the messy
  realities" and needs its own design pass, not a bolt-on.
- **Group-announcement channel** — per the spec's own instruction,
  proposed only, not built: an env var (`TELEGRAM_ANNOUNCE_CHAT_ID`)
  plus reusing `sendMessage` for round-completion/Best-Baby-crowned
  broadcasts, whenever you want it.

## Phase 7 — Spectator screen ✅ DONE

- [x] `src/lib/spectator-state.ts` — the view-model shared between the
      initial server render and the poll endpoint: active matches, who's
      on deck, the full star chart, gold-star counts, a computed stage
      banner ("PLAYPEN ROUND 2 — 12 babies left" / "LOSERS FINAL" /
      "GRAND FINAL" / etc.), open-help-request count. Also runs the lazy
      auto-confirm check (`ensureMatchNotExpired`) on every unconfirmed
      REPORTED match before rendering — this is *the* read path that
      makes the no-worker auto-confirm design work in practice, since
      the spectator screen polls constantly all night
- [x] `GET /api/playtime/[slug]/state?since=<lastEventId>` — unauthenticated,
      returns `{ unchanged: true }` cheaply when nothing happened, the
      full state otherwise, reusing the append-only `MatchEvent` log as
      the cursor (the same log that already powers admin undo)
- [x] `src/components/spectator/*` — `StageBanner`, `CurrentMatches`
      (reuses the Phase 5 `CountdownTimer` for the auto-confirm window),
      `SpectatorStarChart` (gold-star-pop animation on newly-earned
      stars only, computed by diffing successive polls — not a blanket
      flash on every poll), `RulesFooter` (permanent one-line strip, not
      the expandable accordion baby pages use), `HelpIndicator`
      (discreet badge, renders nothing when count is 0)
- [x] `SpectatorPoller` client component — polls every 3s via
      `fetch`+`setInterval` (decided in Phase 1: not SSE, Heroku's
      router kills idle connections past 55s and dyno restarts drop
      long-lived ones anyway)
- [x] `/live/[slug]` — forces dark mode via an inline script (same
      no-flash pattern as the root layout's theme script) regardless of
      the room's system preference, since projectors wash out dusty
      pastels badly (spec). Doesn't touch localStorage, so it doesn't
      leak into anyone's saved preference elsewhere in the app
- [x] **Verified against real Postgres and a real browser**: stage
      banner text through pre-start/playpen/round-robin states, station
      scheduling reflected in active-vs-on-deck matches, `lastEventId`
      advancing on a confirmation, the cheap `{unchanged: true}` poll
      response, 404 for an unknown slug — plus a genuine two-tab browser
      run confirming forced dark mode against an emulated light-preferring
      system, and the live poller picking up an admin-panel confirmation
      within its own 3s polling loop (not just the API in isolation)

**Two test bugs worth remembering, not app bugs:** the verification
script initially grabbed the playtime's database `id` instead of its
`slug` from the admin URL (`/admin/playtimes/[id]` uses the id, `/live/[slug]`
needs the slug) — wrong assumption, not a wrong implementation. Separately,
scoping a Playwright locator to "the enclosing match card" via a `div`
`:has()`/`filter({has})` selector silently grabbed *every* ancestor div
containing the button (all the way up to `<body>`), not just the
intended card, because `:has()` matches ancestors at any depth — since
`<form>` elements can't nest in HTML, filtering on `form` instead of
`div` was the actual fix. Both worth remembering for any future
Playwright verification script in this project, not just this phase's.

### Addendum — Phase 2 rendered as an actual bracket

The spectator screen originally listed Phase 2 (`QF1`/`QF2`/`LOSERS_R1`/
`WINNERS_FINAL`/`LOSERS_FINAL`/`GRAND_FINAL`) as a flat, chronological
match list — functional but not recognizable as a *bracket*. Added
`@g-loot/react-tournament-brackets` to render it as one:

- `src/lib/bracket-view.ts` — pure mapper from the DB's Phase 2 matches
  onto the library's `{ upper, lower }` shape, using the fixed six-match
  DAG from `bracket-engine/phase2.ts` (same wiring, re-expressed as
  `nextMatchId`/`nextLooserMatchId` edges). Matches not yet created in the
  DB (their feeders haven't resolved) render as `TBD` placeholders so all
  six slots are always visible, not just what exists so far. Returns
  `null` while still in playpens, or for the N=3 round-robin path that
  never reaches Phase 2 at all — the spectator screen just omits the
  section in that case.
- `src/components/spectator/Phase2Bracket.tsx` — client component
  wrapping `<DoubleEliminationBracket>` with a custom `matchComponent`
  built from our own Tailwind tokens (not the library's default
  styled-components look), and a `createTheme()` override matching the
  spectator screen's forced-dark palette.
- `src/lib/spectator-state.ts` gained a `phase2Bracket` field, computed
  once and shared by both the initial server render and the poll
  endpoint (`/api/playtime/[slug]/state`) — no separate fetch.
- **Peer dependency workaround, not optional**: the library declares
  peers on React 18 and `styled-components@^4`; both work fine at
  runtime with React 19 / styled-components 6 (verified via a full
  `next build` + real SSR render, not just typecheck), but `npm ci`
  refuses to resolve the conflict without help. Added `.npmrc` with
  `legacy-peer-deps=true` — without it, CI's `npm ci` step (and Heroku's
  buildpack, which also runs `npm ci`) fails outright before ever
  reaching the app code. Also needed a hand-written
  `src/types/g-loot-react-tournament-brackets.d.ts` ambient module
  declaration: the package's own `package.json` points `types` at a
  `dist/index.d.ts` that doesn't exist in the published build (the real
  file is `dist/esm/index.d.ts`) — a packaging bug in the library, not
  something to wait on upstream for.
- **Verified**: `npm run rehearsal` seeded a full tournament through
  Phase 2 to completion, then `curl`'d `/live/[slug]` directly (not just
  typecheck) — the bracket SSRs correctly with real baby names, winner
  highlighting, and no console/server errors; confirmed a clean `npm ci`
  from scratch afterwards to catch exactly the CI failure mode above
  before it could surface as a real pipeline break.

## Phase 8 — Heroku deploy + rehearsal seed ✅ DONE (locally) — not yet actually deployed

Everything below is built and verified against local Postgres. **Nothing
has been provisioned on Heroku** — no `heroku create`, no addon, no
deploy. That's real infrastructure/billing, left for an explicit
decision rather than done unilaterally; see the README's "Deploying to
Heroku" section for the exact steps when you're ready.

- [x] `Procfile` — `web: next start -p $PORT`, `release: prisma migrate
      deploy && ensure-admin-seed`
- [x] Moved `prisma`, `tsx`, `dotenv` from devDependencies to
      dependencies — they're needed at Heroku's *release*-phase runtime
      (which shares the built slug, not a fresh install), not just build
      time, so this doesn't depend on devDependency-pruning behavior
      that varies by `NODE_ENV` config var
- [x] `scripts/rehearsal-seed.ts` — a real, permanent, re-runnable
      script (`npm run rehearsal`), not a throwaway: 13 cute placeholder
      babies, played to completion through the actual lifecycle
      functions, deliberately **left in the database** afterwards so you
      can inspect the finished playtime in the admin panel and on
      `/live/<slug>`. Verified twice, including after the contrast fixes
      below
- [x] **The axe-core a11y suite the spec asked for, genuinely missing
      until now** — `playwright.config.ts` + `tests/a11y/`: seeds real
      data, signs in for real (drives the login form once, reuses the
      session), checks 9 key screens × light/dark. `THEME` is a
      server-startup env var, not a runtime toggle, so covering all 4
      combinations means running the suite once per skin — the CI
      workflow does that as a matrix job; verified locally for **both**
      `nursery` and `plain`, 17/17 passing each time
- [x] `.github/workflows/ci.yml` — lint/typecheck/vitest/build job, plus
      the a11y matrix job with a real Postgres service container
- [x] `app.json` — documents every required config var (so `heroku
      create`/pipelines have something to read), Postgres Essential-0 +
      Eco dyno as the starting tier
- [x] README: full local-dev instructions, a rehearsal section, an
      accessibility section, and step-by-step (not-yet-executed) Heroku
      deploy instructions

**Six real WCAG AA contrast failures found and fixed — this is exactly
what wiring up axe-core was for.** The first real run of the suite
failed 6 tests, all `color-contrast`, all in dark mode:
`Button`'s default variant, `RulesBar`'s pill, `StarChart`'s "you" row
highlight, `HelpIndicator`, `RulesPanel`'s "Tonight only" box, and
`RequestHelpButton`'s selected reason chip. The root cause was the same
everywhere: text colored `text-foreground` (or plain white) rendered on
top of an **accent** color (`--accent-pink`/`-blue`/`-yellow`) or
**`--danger`** — and in dark mode, both of those are *light* pastel
tones (by design, so they read as soft highlights against the dark
page), which light `--fg`/white text fails against badly (as low as
1.14:1 against a 4.5:1 requirement). My Phase 2 contrast script had
verified light-mode text-on-accent pairs and dark-mode text-on-*page*
pairs, but never checked dark-mode text-on-*accent* — a real gap in that
earlier verification, not caught until a tool actually rendered the
CSS and measured it.

Fixed with two new tokens, `--on-accent` and `--on-danger`, defined
per-block (all six theme blocks) rather than derived from `--fg`, since
the right text color for "on top of an accent/danger surface" doesn't
track light/dark mode the same way body text does — it tracks whether
*that specific surface* is light or dark in that mode, which for
`--danger` is the **opposite** direction from the accent colors (danger
is dark in light mode, light in dark mode; accents are light in *both*
modes). Verified with the same contrast-ratio script method as Phase 2,
then confirmed for real with axe-core — 17/17 passing after the fix, in
both skins. Also fixed a `bg-accent-blue/40` opacity-blended highlight
in `StarChart` to a solid color, since alpha-blended text backgrounds
make contrast depend on whatever's rendered underneath rather than being
a fixed, verifiable value.

**Two smaller things also worth remembering:**
- `next/headers` (used by `src/lib/auth.ts` for session cookies) only
  resolves inside Next's own module system — `tsx` tolerates it, but
  Playwright's test-file loader doesn't. `tests/a11y/global-setup.ts`
  can't import anything from `auth.ts`, even indirectly, and inlines the
  one bcrypt call it actually needs instead.
- `__dirname` doesn't exist under `"type": "module"` — same fix as
  earlier phases (`fileURLToPath(import.meta.url)`), needed again in
  both new Playwright files.

**What's left, honestly:** actual Heroku provisioning and deployment;
running the rehearsal against the real production database; registering
the real webhook against the real URL. All documented, none done.

### Addendum — `scripts/rehearsal-with-telegram.ts`

Added after Phase 8 at your request: a variant of the rehearsal script
that links a *real* Telegram account instead of only fake data — prints
a `t.me/...` deep link, polls the DB for you to tap `/start`, then
auto-plays fake babies around you. With `--with-baby`, it also reserves
one baby slot for you to join and genuinely play a match through the
real UI (not simulated) while everything else keeps auto-playing.

**Verified live**, not just written: set up a real `cloudflared` tunnel,
registered the webhook, ran the script twice (once hitting the 5-minute
timeout as designed when nothing was tapped yet, once completing
successfully after linking) — 12 fake babies auto-played to a real
finished tournament, admin got the real "you're linked" Telegram
message. `--with-baby` mode itself wasn't run in this session (would
need a second interactive round-trip), but shares the exact same
wait-and-poll pattern already proven to work for the admin link, applied
to a `Baby` row instead of an `Admin` row.

One real design bug caught and fixed *before* running it, by re-reading
my own draft: the first version treated *any* match containing the
linked real baby as "your turn to play," including ones still `PENDING`
(not yet scheduled to a station, no push sent yet) — which would have
made the script sit there waiting for a push that was never coming,
instead of auto-playing other fake-babies-only matches until the
scheduler actually promoted the real baby's match to `READY`. Fixed to
only treat it as "your turn" once the match is `READY`/`IN_PROGRESS`/
`REPORTED`.

Also caught mid-session: `TELEGRAM_WEBHOOK_SECRET` is self-generated,
not issued by Telegram/BotFather — worth being explicit about in the
README, since it wasn't obvious from the earlier phases' code alone.
