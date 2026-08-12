import { JoinQrPair } from "@/components/ui/JoinQrPair";

/**
 * The "check-in" block shown while a playtime's status is NURSERY_OPEN —
 * the join QR pair plus whatever's below it. Shared by both the public
 * spectator screen (SpectatorPoller, with the Kahoot-style badge row as
 * `children`) and the admin control panel (playtimes/[slug]/page.tsx,
 * with the manage-babies list — Preview/Remove — as `children` instead),
 * so the QR display itself (size, spacing) never drifts between the two.
 */
export function NurseryCheckIn({
  telegramLink,
  websiteLink,
  children,
}: {
  telegramLink: string | null;
  websiteLink: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <JoinQrPair telegramLink={telegramLink} websiteLink={websiteLink} size={400} />
      {children}
    </div>
  );
}
