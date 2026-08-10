import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTerminology } from "@/lib/terminology";

export interface StarChartRow {
  babyId: string;
  displayName: string | null;
  status: "ACTIVE" | "NAPPED" | "CHAMPION";
  finalPlacement: number | null;
  goldStars: number;
}

/**
 * A real `<table>` with proper headers, not a div grid — screen-reader
 * navigable by row/column, each cell has full accessible text (e.g. "3
 * gold stars"), and status is never colour-only (paired with the word
 * "Napped"/"Active"/"Best Baby" every time).
 */
export function StarChart({ rows, currentBabyId }: { rows: StarChartRow[]; currentBabyId: string }) {
  const t = getTerminology();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.standings[0]!.toUpperCase() + t.standings.slice(1)}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Standings — each row shows a {t.player}&apos;s gold stars and current status.
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-foreground-muted">
              <th scope="col" className="py-1 pr-2">
                {t.player[0]!.toUpperCase() + t.player.slice(1)}
              </th>
              <th scope="col" className="py-1 pr-2">
                {t.matchWin[0]!.toUpperCase() + t.matchWin.slice(1)}s
              </th>
              <th scope="col" className="py-1">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isYou = row.babyId === currentBabyId;
              const statusLabel =
                row.status === "CHAMPION"
                  ? `🌟 ${t.champion}`
                  : row.status === "NAPPED"
                    ? `Napped — ${row.finalPlacement ?? "?"}${ordinalSuffix(row.finalPlacement)}`
                    : "Active";
              return (
                // Solid bg-accent-blue + text-on-accent, not a
                // semi-transparent accent-blue/40 over text-foreground-muted:
                // the blended effective color depends on whatever's behind
                // it, and axe-core caught it failing 4.5:1 in dark mode —
                // opacity-blended text backgrounds are fragile for contrast
                // in general, not just here.
                <tr
                  key={row.babyId}
                  className={`border-b border-border last:border-0 ${isYou ? "bg-accent-blue font-semibold text-on-accent" : ""} ${row.status === "NAPPED" ? "opacity-70" : ""}`}
                >
                  <th scope="row" className="py-1 pr-2 text-left font-normal">
                    {row.displayName ?? "Unnamed baby"}
                    {isYou && <span className="ml-1 text-xs">(you)</span>}
                  </th>
                  <td className="py-1 pr-2">
                    <span aria-hidden className="text-star-gold">
                      {"★".repeat(Math.min(row.goldStars, 10))}
                    </span>
                    <span className="sr-only">
                      {row.goldStars} gold star{row.goldStars === 1 ? "" : "s"}
                    </span>
                    <span aria-hidden> {row.goldStars}</span>
                  </td>
                  <td className="py-1">{statusLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ordinalSuffix(n: number | null): string {
  if (n == null) return "";
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
