import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { getCurrentBaby } from "@/lib/baby-auth";
import { getTerminology } from "@/lib/terminology";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePlaytimeButton } from "@/components/admin/CreatePlaytimeButton";
import { MorePlaytimesModal } from "@/components/baby/MorePlaytimesModal";
import { GAME_DISPLAY, PLAYTIME_STATUS_DISPLAY } from "@/lib/enum-display";
import type { Playtime } from "@/generated/prisma/client";

// Three audiences on one URL: an admin sees every playtime (any status)
// plus the create control; a signed-in baby sees only the playtime(s)
// they're actually part of, plus a "More playtime!" button to join
// another still-open one; anyone else sees the public "what's on right
// now" index (COMPLETE hidden, no controls). Delete-all lives in
// Settings' danger zone, not here.
export default async function PlaytimesListPage() {
  const admin = await getCurrentAdmin();
  const currentBaby = admin ? null : await getCurrentBaby();

  let playtimes: (Playtime & { _count: { babies: number } })[];
  let joinModal: React.ReactNode = null;

  if (admin) {
    playtimes = await prisma.playtime.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { babies: true } } },
    });
  } else if (currentBaby) {
    // "My playtimes" — every playtime this baby is part of, any status
    // (so a finished one stays reachable to see the final placement).
    // Cross-referenced by telegramChatId, not just the session's own
    // Baby row: the same Telegram account legitimately has one Baby row
    // per playtime it's joined (Baby.telegramChatId is unique *per
    // playtime*, not globally — see the schema comment), so a repeat
    // attendee sees every night at a glance, not just tonight's.
    // Website-only babies (no Telegram) only ever match their own id.
    const myBabies = await prisma.baby.findMany({
      where: {
        OR: [
          { id: currentBaby.id },
          ...(currentBaby.telegramChatId ? [{ telegramChatId: currentBaby.telegramChatId }] : []),
        ],
      },
      include: { playtime: { include: { _count: { select: { babies: true } } } } },
    });
    playtimes = myBabies
      .map((b) => b.playtime)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const myPlaytimeIds = playtimes.map((p) => p.id);
    const joinablePlaytimes = await prisma.playtime.findMany({
      where: { status: "NURSERY_OPEN", id: { notIn: myPlaytimeIds } },
      orderBy: { createdAt: "desc" },
    });
    const t = getTerminology();
    joinModal = (
      <MorePlaytimesModal
        buttonLabel={t.morePlaytimesButtonLabel}
        joinable={joinablePlaytimes.map((p) => ({ slugNumber: p.slugNumber, name: p.name, game: p.game }))}
      />
    );
  } else {
    playtimes = await prisma.playtime.findMany({
      where: { status: { not: "COMPLETE" } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { babies: true } } },
    });
  }

  // Signed-in admins already get a padded, max-w-5xl <main> from the
  // layout — this page's own root only needs to add that itself for
  // the other cases, where the layout deliberately renders a bare,
  // unpadded full-width wrapper instead (so /playtimes/[slug]'s public
  // spectator screen can go edge-to-edge on a projector). Adding it here
  // rather than in the layout keeps that full-bleed behavior for the
  // spectator screen while still giving this list page real margins.
  return (
    <div className={admin ? "flex flex-col gap-6" : "mx-auto flex max-w-5xl flex-col gap-6 p-6"}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Playtimes</h1>
        {admin ? (
          <div className="flex gap-2">
            <CreatePlaytimeButton />
          </div>
        ) : currentBaby ? (
          joinModal
        ) : (
          <Link href="/login" className="text-sm font-semibold text-foreground-muted hover:opacity-80">
            Login
          </Link>
        )}
      </header>

      <Card>
        <CardContent>
          {playtimes.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              {admin
                ? "No playtimes yet, create one above."
                : currentBaby
                  ? "You're not signed up for anything yet."
                  : "Nothing running right now, check back soon."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {playtimes.map((p) => {
                const game = GAME_DISPLAY[p.game];
                const status = PLAYTIME_STATUS_DISPLAY[p.status];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/playtimes/${p.slugNumber}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card border border-border bg-background px-4 py-3 hover:opacity-90"
                    >
                      {/* flex-wrap on the row — the name+game group and
                          the count+status group each stay on one line,
                          but drop onto their own row once both together
                          don't fit, instead of everything fighting a flex
                          item's default `min-width: auto` (its content's
                          own intrinsic, unwrapped width) and forcing the
                          whole row wider than its container, which pushed
                          the entire page into unwanted horizontal scroll.
                          min-w-0 + truncate on the name is still a
                          backstop for a name so long even its own solo
                          line couldn't fit it. */}
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold">{p.name}</span>
                        <Badge variant={game.variant} className="shrink-0">
                          {game.label}
                        </Badge>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-sm text-foreground-muted">{p._count.babies} babies</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
