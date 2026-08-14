import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTerminology, getThemeSkin } from "@/lib/terminology";

const SWATCHES = [
  { label: "background", varName: "--bg" },
  { label: "background elevated", varName: "--bg-elevated" },
  { label: "foreground", varName: "--fg" },
  { label: "foreground muted", varName: "--fg-muted" },
  { label: "border", varName: "--border" },
  { label: "accent pink", varName: "--accent-pink" },
  { label: "accent blue", varName: "--accent-blue" },
  { label: "accent mint", varName: "--accent-mint" },
  { label: "accent yellow", varName: "--accent-yellow" },
  { label: "star gold", varName: "--star-gold" },
  { label: "success", varName: "--success" },
  { label: "danger", varName: "--danger" },
  { label: "active", varName: "--active" },
] as const;

// Living style-guide from Phase 2 — kept as a reference for the token
// system (colors, fonts, motifs, focus states), not part of the app's
// real navigation. See /playtimes, /playtimes/[slug] for that.
export default function StyleGuidePage() {
  const t = getTerminology();
  const skin = getThemeSkin();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-3xl font-bold">Playtime style guide</h1>
        <p className="text-sm text-foreground-muted">
          Design-system reference, skin: <strong>{skin}</strong>
        </p>
      </header>

      <Card
        className="relative overflow-hidden"
        style={{ backgroundImage: "var(--motif-primary)", backgroundRepeat: "no-repeat", backgroundPosition: "top right", backgroundSize: "140px" }}
      >
        <CardHeader>
          <CardTitle>Terminology (from src/lib/terminology.ts)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-foreground-muted">Tournament</dt>
            <dd>{t.tournament}</dd>
            <dt className="text-foreground-muted">Group-stage heat</dt>
            <dd>{t.groupStageHeat}</dd>
            <dt className="text-foreground-muted">Standings</dt>
            <dd>{t.standings}</dd>
            <dt className="text-foreground-muted">Match win</dt>
            <dd>{t.matchWin}</dd>
            <dt className="text-foreground-muted">Registration</dt>
            <dd>{t.registration}</dd>
            <dt className="text-foreground-muted">Waiting for match</dt>
            <dd>{t.waitingForMatch}</dd>
            <dt className="text-foreground-muted">Champion</dt>
            <dd>{t.champion}</dd>
          </dl>
          <p className="mt-3 text-sm">{t.earnedMatchWin("Baby Sam")}</p>
          <p className="text-sm">{t.eliminatedWithPlacement(7)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sticker-chart row example</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-pill border border-border bg-background px-4 py-3">
            <span className="font-semibold">Baby Sam</span>
            <span aria-hidden className="text-star-gold">
              ★★★
            </span>
            <span className="text-sm text-foreground-muted">
              3 {t.matchWin}s · {t.groupStageHeat} 2 · 1st place
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map((s) => (
              <li key={s.varName} className="flex items-center gap-2 text-xs">
                <span
                  className="h-8 w-8 shrink-0 rounded-full border border-border"
                  style={{ background: `var(${s.varName})` }}
                  aria-hidden
                />
                <span>
                  {s.label}
                  <br />
                  <code className="text-foreground-muted">{s.varName}</code>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buttons &amp; focus</CardTitle>
          <CardDescription>Tab to the buttons below to check the focus ring.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Request help from {t.admin}</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="destructive">Dispute result</Button>
          <Button variant="ghost">Ghost action</Button>
        </CardContent>
      </Card>
    </main>
  );
}
