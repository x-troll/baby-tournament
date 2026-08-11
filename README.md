# Playtime

A self-serve tournament bracket manager for a one-night bar event. Players
check a screen, get pinged on Telegram, play, and report their own
results — the admin ("Daddy") creates the tournament and does zero live
organizing.

Built with Next.js (App Router), Prisma + Postgres, and a Telegram bot.
Full spec: [`tournament-app-prompt.md`](./tournament-app-prompt.md).
Phase-by-phase build log and design decisions: [`PLAN.md`](./PLAN.md) —
**read that first** if you want to understand *why* something is built
the way it is, not just what it does.

**Status:** All 8 phases are built and verified locally (schema, bracket
engine, design system, rules content, admin panel, baby UI, Telegram bot,
spectator screen, CI, rehearsal seed). **Nothing has actually been
deployed to Heroku yet** — that's a real infrastructure/billing action,
left for you to do (or ask for explicitly) rather than done unilaterally.
Everything below the "Deploying" section works today against your own
local Postgres.

## Prerequisites

- Node 24.x (see `engines` in `package.json`)
- A local Postgres instance
- Optional, for the Telegram bot to actually send anything: a bot token
  from [@BotFather](https://t.me/BotFather). Without one, the app runs
  fine and logs `[telegram:noop] ...` instead of sending — useful for
  local dev.

## Setup

```bash
npm install                          # also runs `prisma generate` (postinstall)

createdb playtime                    # or point DATABASE_URL at an existing db

cp .env.example .env                 # then edit .env — see below
npx prisma migrate deploy            # applies all committed migrations

npm run db:seed                      # creates the first Daddy from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                          # http://localhost:3000
```

### `.env`

Copy `.env.example` and fill in at minimum:

- `DATABASE_URL` — your local Postgres connection string
- `AUTH_SECRET` — any random string (`openssl rand -base64 32`); signs
  both admin and baby session cookies
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — used once by `npm run db:seed` to
  create the first Daddy account (change the password from the admin
  panel afterwards — the seed script is idempotent and won't touch it again)
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev

Everything Telegram-related (`TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`) is optional locally.
Without a token the bot no-ops (logs instead of sending); without a
webhook the `/api/telegram/webhook` route just won't receive anything
from a real bot, which is fine for testing everything else.

## Using it locally

1. Sign in at **`/admin/login`** with the seeded `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
2. Create a playtime, add a few babies manually (no Telegram needed —
   that's the spec's own fallback for babies without it).
3. Open the nursery, then start the playtime once you have at least 3 babies.
4. From the playtime's admin page, each baby row has a **Preview**
   button — this creates a real baby session and drops you into their
   `/play/[slug]` screen, without needing the Telegram bot at all. Use
   two browser profiles (or one normal + one incognito window) to play
   both sides of a match and see the confirm/dispute flow.
5. Open **`/live/[slug]`** in another tab/window for the spectator screen
   — it polls every 3s and picks up whatever you do in the other tabs.
6. To actually exercise the Telegram bot, see the next section.

## Setting up the Telegram bot for local testing

The bot itself needs three things, and it's worth being clear about
where each one comes from:

- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` — from
  [@BotFather](https://t.me/BotFather) (`/newbot`). These identify *your
  bot*.
- `TELEGRAM_WEBHOOK_SECRET` — **you make this up yourself**, it doesn't
  come from Telegram or BotFather. It's a shared secret: you tell
  Telegram what it is (via `setWebhook`), Telegram echoes it back on
  every request it sends your webhook, and the route checks it matches
  before trusting the request. Generate one with `openssl rand -hex 32`.

Telegram's servers need a real public HTTPS URL to reach — `localhost`
doesn't work. Use a tunnel:

```bash
brew install cloudflared          # no account/signup needed, unlike ngrok
cloudflared tunnel --url http://localhost:3000
```

That prints a `https://<random-words>.trycloudflare.com` URL. Set
`NEXT_PUBLIC_APP_URL` to it, restart `npm run dev` (env vars only load at
startup), then sign in and click **"Register Telegram webhook"** on
`/admin/profile`.

**One bot, shared between local and production** (the simpler of two
reasonable setups — see `PLAN.md` for the alternative): a webhook is
global to a bot, so registering your local tunnel's webhook and later
registering the deployed app's webhook are mutually exclusive — whichever
you registered *last* is the one that's active. That's fine as long as
you're not testing locally and running the real event at the same time;
just re-click "Register Telegram webhook" (or re-run the register step)
whichever environment you want live at that moment.

The `trycloudflare.com` URL is temporary — it dies when `cloudflared`
stops, and you'll get a new random URL if you restart it, meaning
`NEXT_PUBLIC_APP_URL` and the registered webhook both need updating
again. Fine for a testing session; once deployed to Heroku the URL is
permanent and you won't deal with this again.

## Rehearsing before the event

```bash
npm run rehearsal
```

Generates a fake 13-baby playtime ("Rehearsal Night") and plays it to
completion through the real lifecycle code — the same functions the
admin panel and baby self-report use, not a separate simulation. Prints
a round-by-round log and the final standings, then **leaves the
playtime in the database** so you can look at it in the admin panel and
on `/live/<slug>`. Safe to re-run — it clears out its own previous
rehearsal first.

### Rehearsing with a real Telegram account

```bash
npm run rehearsal:telegram                  # link yourself as Daddy, receive real pushes
npm run rehearsal:telegram -- --with-baby   # also join as a real baby and play a match for real
```

Needs the Telegram bot actually set up (previous section). Prints a
`t.me/...` link, waits (up to 5 minutes) for you to tap `/start` in
Telegram, then auto-plays 12 fake babies around you. With `--with-baby`,
it reserves one slot, prints a second join link, and — once you're
checked in — genuinely pauses at *your* matches instead of auto-playing
them: you get the real "it's your turn" push, use the real drag-to-reorder
or gold-star button, and can let the 60s auto-confirm timer actually run
out if you want to see it fire for real (nobody else is there to confirm
it). Everything else keeps auto-playing in the background while it waits.

## Deploying to Heroku

Not yet done — here's how, when you're ready. `app.json` documents every
required config var if you'd rather read that directly.

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0

heroku config:set \
  AUTH_SECRET="$(openssl rand -base64 32)" \
  TELEGRAM_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  ADMIN_USERNAME="daddy" \
  ADMIN_PASSWORD="something-you-will-change-immediately" \
  THEME="nursery"

git push heroku main

# Now that you have the real URL:
heroku config:set NEXT_PUBLIC_APP_URL="https://your-app-name.herokuapp.com"

# Optional, for the bot:
heroku config:set TELEGRAM_BOT_TOKEN="..." TELEGRAM_BOT_USERNAME="..."
```

The `release` phase in `Procfile` runs `prisma migrate deploy` and seeds
the first Daddy automatically on every deploy (the seed is idempotent —
it only creates an admin if none exist yet). The webhook itself
registers automatically on boot (`src/instrumentation.ts`) once
`TELEGRAM_BOT_TOKEN`/`NEXT_PUBLIC_APP_URL`/`TELEGRAM_WEBHOOK_SECRET` are
all set — a Heroku dyno restarts on every `config:set`, so the last of
those three you set is what triggers it. The **"Register Telegram
webhook"** button on `/admin/profile` still exists for re-registering by
hand (e.g. if you rotate the bot token later without changing anything
else, which wouldn't otherwise trigger a restart).

Then run `npm run rehearsal` **against production** once
(`heroku run npm run rehearsal`) as your final check before the actual
event.

## Key URLs

| Route | Who | Notes |
|---|---|---|
| `/admin/login`, `/admin/**` | Daddy | credentials login, session cookie |
| `/play/[slug]` | Baby | Telegram magic-link session, or admin "Preview" |
| `/live/[slug]` | Anyone | unauthenticated, read-only, TV/projector |
| `/rules-preview` | Anyone | demo of the rules content pipeline (Phase 3) |
| `/style-guide` | Anyone | design-token/terminology reference (Phase 2) |
| `/api/telegram/webhook` | Telegram | bot webhook, secret-token verified |
| `/api/playtime/[slug]/state` | Spectator poller | cheap event-cursor polling endpoint |

## Commands

```bash
npm run dev            # dev server
npm run build            # production build (also validates content/rules/*.md)
npm run start              # run a production build
npm run test                 # Vitest — the bracket engine's 123 tests, zero DB
npm run lint                     # eslint (includes jsx-a11y)
npm run typecheck                  # tsc --noEmit
npm run prisma:migrate               # create + apply a new migration in dev
npm run db:seed                        # idempotent — seeds the first Daddy only if none exist
npm run rehearsal                        # plays a fake 13-baby tournament to completion — see below
```

## Rules content

Game rules live in `content/rules/{mario-kart,super-smash}.md` as
Markdown with YAML frontmatter (summary + screenshots). `npm run build`
fails loudly if a file is missing, a summary is empty, or a referenced
screenshot doesn't exist on disk — edit those files and drop real
screenshots in `public/rules/<game>/` before the event; the committed
ones right now are placeholders.

## Project structure (high level)

- `src/lib/bracket-engine/` — the pure tournament-structure logic (pen
  layout, seeding, Phase 2 double-elimination, placements). Zero DB/React
  imports, 123 Vitest tests, no themed copy — see Phase 1 in `PLAN.md`.
- `src/lib/playtime-lifecycle.ts` — wires the engine to Postgres: starting
  a playtime, reporting/confirming/disputing results, round advancement,
  scheduling, notifications.
- `src/lib/telegram/` — the bot: API client, message copy, webhook
  command routing, notification dispatch.
- `src/lib/terminology.ts` — every nursery term in one place; also the
  `THEME=plain` neutral-skin switch.
- `src/components/{ui,baby,spectator,rules,admin,theme}/` — UI grouped by
  audience.
- `prisma/schema.prisma` + `prisma/migrations/` — the data model.

For the *why* behind any of this — including several real bugs found and
fixed during each phase's verification — see `PLAN.md`.
