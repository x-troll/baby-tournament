# Prompt for Claude Code (plan mode)

Copy everything below the line into Claude Code with plan mode on (Shift+Tab).

---

Plan a new Next.js web app: a self-serve tournament bracket manager for a one-night bar event. Think Challonge, but locked down — only admins create tournaments — and built so that **I do zero organizing during the event**. Players check the screen, get pinged on Telegram, play, and report their own results.

Do not write code yet. Produce a phased implementation plan. Most decisions below are already made — follow them. Only ask me about things I haven't specified.

## Stack

- Next.js (App Router, TypeScript), deployed to **Heroku**
- **Heroku Postgres** via Prisma
- Tailwind + shadcn/ui
- Telegram Bot API via webhook (Heroku gives a stable HTTPS URL, so use webhooks, not polling)
- Single Heroku web dyno — no separate worker process, no Redis, unless you can justify it. Notifications are sent inline when state changes.

## Games

Exactly two, hardcoded as an enum: **Mario Kart** and **Super Smash Bros**. A tournament is for one game. Both run through the same bracket engine; they differ only in label, expected match duration (Mario Kart ~8 min, Smash ~6 min, both configurable), and their rules content.

## House rules per game

I define the rules myself, as **markdown files committed to the repo** — no CMS, no admin editor. One file per game:

```
content/rules/mario-kart.md
content/rules/super-smash.md
```

Each file has YAML frontmatter and a markdown body:

```yaml
---
game: MARIO_KART
summary: "No items · Random map · 150cc"   # the one-liner
screenshots:
  - src: /rules/mario-kart/settings-1.png
    caption: "Race settings screen — match this exactly"
  - src: /rules/mario-kart/settings-2.png
    caption: "Item setting: None"
---
```

Parsed at build time (gray-matter + a markdown renderer — pick one, render server-side, no client-side markdown bundle). Validate the frontmatter with Zod and **fail the build** if a game is missing a rules file, a `summary`, or if a referenced screenshot doesn't exist. I'd rather find that in CI than at the bar.

**Screenshots** are photos/captures of the in-game settings screen, so everyone can match their console setup to mine. Commit them to `public/rules/<game>/`. Do **not** build an upload feature — Heroku's dyno filesystem is ephemeral and anything uploaded disappears on restart. Serve them through `next/image`.

**Display rules — always visible on every baby-facing page:**

- A persistent, compact **rules bar**: the one-line `summary`, styled as a small themed pill/banner, plus a chevron. Never hidden behind a menu.
- Tapping it expands a collapsible panel (accordion) with the full rendered markdown and the screenshot thumbnails.
- Tapping a screenshot opens it **full-screen, zoomable and pinchable**. These are settings screens with small text being read on a phone in a bar — a thumbnail is useless, the zoom is the whole point.
- Expanded/collapsed state persists in localStorage so it doesn't fight the player.
- The rules bar is themed like everything else — in dark mode it's a soft moonlit strip, not a harsh alert banner.

**Also surface the rules:**

- On the **spectator screen**, as a permanent one-line footer or side strip with the summary, so people can read it from across the room without touching anything.
- In **Telegram**: a `/rules` command returning the full rules and screenshots, and the one-line summary appended to every "you're up now" push.
- On the **check-in page**, expanded by default, so babies read them at registration.

**Per-playtime override:** an optional free-text note on the tournament itself (e.g. "tonight: 3 races per match") that renders above the game rules, clearly marked as a tonight-only change. Optional, blank by default.

---

## Theme and voice — this is a core requirement, not decoration

The whole app is **ABDL-coded**: a soft, playful, nursery aesthetic. This is an adults-only kink-themed bar event, so lean into the aesthetic confidently, but keep it *suggestive and cute rather than explicit* — nothing sexual anywhere in the UI.

**Terminology (use consistently across web UI, Telegram messages, and the spectator screen):**

The names here should be in a single file, so I can easily change the terminology everywhere in the solution if needed.

| Concept | Term in the app |
|---|---|
| Player | **baby** / **babies** |
| Admin | **Daddy** / **The daddies**
| Tournament | **playtime** |
| Group-stage heat | **playpen** |
| Bracket / standings | **the star chart** |
| Winning a match | earning a **gold star** |
| Eliminated | sent for a **nap** (show final placement) |
| Registration / check-in | **the nursery** |
| Waiting for your match | **quiet time** |
| Overall champion | **Best Baby** |

**Visual direction — shared across both modes:**

- Everything heavily rounded — big pill buttons, rounded cards, chunky borders. Soft shadows, no hard black, no sharp corners anywhere.
- Rounded/bubbly display font for headings (something like Fredoka, or Nunito), a clean legible sans for body text.
- Standings styled as a literal **sticker chart** — a row per baby, gold stars earned across the night.
- Gentle micro-animations: stars popping in when a result confirms, a soft wobble on the "you're up next" card. Respect `prefers-reduced-motion`.

**Light and dark mode, following the phone's system setting** (`prefers-color-scheme`, with a manual override toggle stored in localStorage). Both modes are pastel — dark mode is not "the same thing but grey," it's a genuinely different, cosier nighttime skin:

- **Light mode — daytime nursery.** Cream and warm white base. Powder pink, baby blue, mint, butter yellow accents. Motifs: clouds, building blocks, rattles, teddy bears, daytime stars.
- **Dark mode — sleepytime nursery.** Deep indigo / midnight navy base rather than black, with dusty pastels layered on top: moonlight lavender, soft periwinkle, muted rose, pale sage. Warm amber glow for anything active or urgent, so it reads like a nightlight. Motifs swap to: crescent moons, sleeping lions with little Zs, drowsy stars, soft clouds drifting across the header, a nightlight glow behind the active-match card. Gold stars stay gold — they should shine against the dark.

Implement both with CSS custom properties on a single token set. The nursery motifs should be swappable per mode via the same token/asset mechanism, not duplicated components.

**Legibility still governs.** Theme the chrome, not the signal. Status text ("YOU'RE UP NOW", "REPORT YOUR RESULT", placements, countdown timers) stays large and unambiguous in both modes. Test the spectator screen in both modes on an actual TV — projectors wash out dusty pastels badly, so the spectator view should default to dark and lean on the amber/gold accents for anything that matters.

Add a `THEME` env flag with values `nursery` (default) and `plain`, orthogonal to light/dark, so I can flip to a neutral skin for screenshots or testing. Four combinations total, one token set, no forked components.

### Accessibility — WCAG 2.2 Level AA, with two stated exceptions

Target **WCAG 2.2 AA** in *every* combination of light/dark and nursery/plain, except the two items listed at the end of this section. Pastels make contrast easy to get wrong, so treat this as a build constraint rather than a polish pass:

- **Contrast:** 4.5:1 for body text, 3:1 for large text (≥24px, or ≥19px bold) and for UI component boundaries and icons. Gold-on-cream and dusty-pastel-on-indigo are the likely failures — check them specifically. Pick the palette to pass, don't pick it and then patch it.
- **Don't encode meaning in colour alone.** A napping baby can't be indicated only by being greyed out, and a winner can't be indicated only by gold. Pair every colour cue with a label, icon, or text ("Napped — 7th").
- **Touch targets:** minimum 24×24 CSS px (2.5.8), but use 44×44 in practice — this is drunk people on phones. Applies to the reorder handles in result reporting too.
- **Focus:** visible focus indicator meeting 2.4.11/2.4.13, never `outline: none`. Keyboard operability for standard controls.
- **Screen readers:** semantic headings, proper landmarks, and an accessible name for every control. The star chart must be navigable non-visually — render it as a real table or list with proper row/column semantics, not a div grid, and give each cell text like "Baby Sam, playpen 2, 1st place, gold star".
- **Live regions:** the "what's happening to me right now" card and countdown timers use `aria-live="polite"` so state changes announce. Do not announce the timer every second — announce at meaningful thresholds only.
- **Motion:** honour `prefers-reduced-motion` for every animation, including the drifting clouds and star pops.
- **Zoom/reflow:** usable at 200% zoom and at 320px width with no horizontal scrolling.

**Two deliberate exceptions — do not "fix" these, and do not let them block the build:**

- **Drag-to-reorder result entry is drag-only.** No keyboard alternative needed (waives 2.1.1 for that one control).
- **The 60-second auto-confirm timer stays as-is** (waives 2.2.1). It's the mechanic that makes the event run without me. Keep it visible and counting down, but no extend/pause control is required.

Add `eslint-plugin-jsx-a11y` and an automated axe-core pass (via `@axe-core/playwright` or `jest-axe`) over the key screens in all four theme combinations, wired into CI so regressions fail the build — with the two exceptions above explicitly suppressed rather than left as noisy warnings.

### "Request help from Daddy" button

Persistent on every baby-facing screen, styled as a big soft pill button.

- Tapping it opens quick-pick reason chips: *controller trouble*, *can't find my opponent*, *score dispute*, *something else* (with a short free-text field).
- Sends a Telegram alert to **all** admins containing: baby's display name, their current match/round, the reason, and a deep link to that match in the admin panel.
- The admin message has inline buttons: **On my way** / **Resolved**. Tapping "On my way" pushes "Daddy is coming 💫" back to the baby and flips their screen into a waiting state.
- Rate limit: 60-second cooldown per baby, and collapse repeat requests for the same match into one thread so the admin chat doesn't get flooded.
- Show open help requests prominently in the admin panel and as a small discreet indicator on the spectator screen.

---

## Bracket rules — this is the hardest part, get it exactly right

### Phase 1: group stage ("playpens")

Babies are split into **playpens of 4, top 2 advance**. Repeat round after round until 4 remain.

Per round, given N babies still alive:

- Solve `4a + 3b = N`, maximising the number of 4-pens. So 8 → 4+4, 7 → 4+3, 6 → 3+3, 11 → 4+4+3, 10 → 4+3+3, 13 → 4+3+3+3.
- Never leave a pen of 1 or 2.
- 3-pens also advance the top 2.
- If N == 4 → go to Phase 2.

**Note this invariant and use it in your tests:** every pen advances exactly 2, so the survivor count after any round is always even. N=5 and N=3 are therefore only ever possible as the *starting* registration count, never mid-tournament.

- **N = 5 at start:** the 3 lowest-seeded babies play one pen, bottom one naps, the other 2 get a bye. (Seed by registration order if there's no history yet.) → 4 remain.
- **N = 3 at start:** skip brackets entirely, run a round-robin, most gold stars wins.

Include in your plan a table of the computed pen layout for every N from 3 to 40 so I can sanity-check the algorithm before you build it.

### Seeding into the final four

Score = **the number of babies you finished ahead of**, summed across every pen you played. (1st in a 4-pen = 3 pts, 2nd = 2; 1st in a 3-pen = 2 pts, 2nd = 1.) Self-normalising across pen sizes — do not invent a separate points table. Tiebreak: head-to-head result, then random. Seeds 1–4 assigned by this score.

### Phase 2: final four — 1v1 double elimination

Once exactly 4 remain, everything is head-to-head, 2 babies per match. Six matches, in this order:

1. **QF1**: seed 1 v seed 4
2. **QF2**: seed 2 v seed 3
3. **Losers round 1**: loser(QF1) v loser(QF2) → loser naps in **4th**
4. **Winners final**: winner(QF1) v winner(QF2) → winner goes straight to the grand final
5. **Losers final**: loser(winners final) v winner(losers round 1) → loser naps in **3rd**
6. **Grand final**: 2 babies. **No bracket reset** — one match, winner is Best Baby. This is deliberate: a surprise 7th match late at night is chaos. Make the "one match, no reset" rule visible in the UI so nobody argues.

### Scheduling

- Matches run **one at a time** by default. Number of stations is a per-playtime setting, default 1.
- Match states: `pending` → `ready` → `in_progress` → `reported` → `confirmed`.
- ETA to next match per baby = `matches queued ahead × rolling average duration for this game`, seeded from the configurable default and updated from real completed match times through the night. Show it as friendly copy: *"Your turn in about 14 minutes — quiet time until then."*

---

## Roles and auth

- **Daddy (admin)**: credentials login (NextAuth credentials provider or a seeded admin table — pick the simplest secure option). Creates playtimes, adds/removes babies, starts rounds, overrides any result, receives help requests.
- **Baby (player)**: no password. Telegram-first — scan a QR code at the bar, open the bot deep link (`t.me/<bot>?start=<joinToken>`), send `/start`, the bot asks for a display name and replies with a magic web link that sets a signed session cookie. Telegram is therefore guaranteed linked for everyone.
  - Admin fallback to add a baby manually with no Telegram (they just get no pings).
- **Spectator**: `/live/<slug>`, unauthenticated, read-only.

## Baby web interface

Mobile-first. Top of the screen is one big "what's happening to me right now" card, in exactly one of these states:

- *Quiet time — your turn in about 14 minutes*
- *You're up next! Head over to the console*
- *You're playing now — report your result*
- *Waiting on your playmates to confirm…*
- *Naptime — you finished 7th. Good baby.*
- *Daddy is coming 💫* (after a help request is acknowledged)

Below that: the full star chart with the baby's own path highlighted, gold stars on won matches, napping babies softened out. And the **Request help from Daddy** button, always reachable.

## Result reporting — one reporter, timed auto-confirm

Do **not** require consensus from all players; it stalls when someone wanders off to the bar.

- **Pens (3–4 babies):** one baby submits the finishing order via drag-to-reorder. Everyone else gets a Telegram push with **Confirm** / **Dispute** inline buttons and a **60-second auto-confirm timer**.
- **1v1 matches:** winner taps "I got the gold star", opponent confirms or the timer does it.
- A dispute freezes the match and alerts the Daddies exactly like a help request.
- Admin override always available. One code path for both cases.

The auto-confirm timer is the single most important mechanic for the app running without me — make sure it's visible and counting down on both the baby screen and the spectator screen.

## Telegram bot

- Webhook at `/api/telegram/webhook`, verified with a secret token.
- Pushes to a baby when: they're on deck (one match ahead), it's their turn, a result needs confirming, their result is confirmed, they nap (with final placement), and when they're crowned Best Baby.
- Pushes to Daddies: help requests, disputes, forfeits, round completions.
- `/status` returns the baby's standing and ETA.
- All bot copy uses the nursery voice, warm and gentle, matching the web UI.
- Optional group-announcement channel: propose it, don't build it in phase 1.

## Spectator screen

For a TV/projector: large type, high contrast, auto-refreshing (poll or SSE — pick one and justify it). Nursery aesthetic scaled up — big sticker chart, gold stars landing with a small animation as results confirm.

Shows: the match in progress with both names, who's on deck, the full star chart, the nap list with placements, and a big obvious stage banner — *"PLAYPEN ROUND 2 — 12 babies left"*, *"LOSERS FINAL"*, *"GRAND FINAL"*. Any live countdown (forfeit clock, auto-confirm timer) shows here too.

## Non-functional

- The bracket engine is a **pure, dependency-free TypeScript module** with Vitest unit tests covering: every N from 3 to 40, the N=5 and N=3 start cases, the even-survivor invariant, seeding score computation including ties, and full Phase 2 progression through all paths. No database or React imports in that module, and no themed copy in it either — it returns structural data, the UI supplies the nursery language.
- All bracket mutations go through server actions that revalidate. No client-side bracket math.
- **Append-only match event log**, so "undo last result" is always safe. Expose that undo in the admin panel.
- Seed script that generates a fake 13-baby playtime and plays it to completion, so I can rehearse the whole flow before the event.

## Handling the messy realities

- **Forfeit clock:** Telegram ping on deck, second ping when it's their turn, then a 5-minute countdown shown on the spectator screen. Expiry = auto-forfeit. The clock does the nagging so I don't have to.
- **No-show before a pen starts:** it just shrinks. A 4-pen becomes a 3-pen, still top 2 advance.
- **Mid-tournament dropout:** walkover for the opponent, recorded as a forfeit in the placement history.
- **Wrong result reported:** admin undo via the event log.

## What I want from you now

1. A phased plan: (1) schema + bracket engine + tests, (2) design system and theme tokens, (3) rules content pipeline, (4) admin panel + playtime lifecycle, (5) baby web UI + result reporting + help button, (6) Telegram bot, (7) spectator screen, (8) Heroku deploy + rehearsal seed.
2. For each phase: the files you'd create and the key decisions baked in.
3. The N=3..40 pen layout table.
4. Starter `content/rules/*.md` files for both games with placeholder rules I can fill in, so the shape is obvious.
5. Anything in this spec that's contradictory, or that you think will bite me on the night.

## How we work together

**Stop after every phase.** When a phase is complete:

1. Update `PLAN.md` — the full phased plan with checkboxes, so progress survives a context compaction.
2. Summarise in a few lines what you built and anything you learned that should change the plan for later phases.
3. **Stop and wait for me to say go.**

Do not start the next phase on your own, even if the next steps seem obvious and even if I've approved the overall plan. I want a gap between every phase to review the work and adjust settings on my end. Treat "approve the plan" as approval to begin phase 1 only.
