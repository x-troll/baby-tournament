import type { SpectatorStarChartRow } from "@/lib/spectator-state";

export function SpectatorStarChart({
  rows,
  justEarnedStarBabyIds,
}: {
  rows: SpectatorStarChartRow[];
  justEarnedStarBabyIds: Set<string>;
}) {
  return (
    <table className="w-full text-lg">
      <caption className="sr-only">Live standings — gold stars and status per baby.</caption>
      <thead>
        <tr className="border-b-2 border-border text-left text-foreground-muted">
          <th scope="col" className="py-2 pr-3">
            Baby
          </th>
          <th scope="col" className="py-2 pr-3">
            Gold stars
          </th>
          <th scope="col" className="py-2">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const statusLabel =
            row.status === "CHAMPION"
              ? `🌟 Best Baby`
              : row.status === "NAPPED"
                ? `Napped — ${row.finalPlacement ?? "?"}`
                : "Active";
          const justEarned = justEarnedStarBabyIds.has(row.babyId);
          return (
            <tr
              key={row.babyId}
              className={`border-b border-border last:border-0 ${row.status === "NAPPED" ? "opacity-60" : ""}`}
            >
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                {row.name}
              </th>
              <td className="py-2 pr-3">
                <span
                  aria-hidden
                  className={`text-star-gold ${justEarned ? "animate-star-pop motion-reduce:animate-none" : ""}`}
                >
                  {"★".repeat(Math.min(row.goldStars, 10))}
                </span>
                <span className="sr-only">
                  {row.goldStars} gold star{row.goldStars === 1 ? "" : "s"}
                </span>
                <span aria-hidden> {row.goldStars}</span>
              </td>
              <td className="py-2">{statusLabel}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
