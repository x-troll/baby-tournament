-- AlterEnum
BEGIN;
CREATE TYPE "MatchKind_new" AS ENUM ('PLAYPEN', 'ROUND_ROBIN', 'QF1', 'QF2', 'LOSERS_R1', 'WINNERS_FINAL', 'LOSERS_FINAL', 'GRAND_FINAL');
ALTER TABLE "matches" ALTER COLUMN "kind" TYPE "MatchKind_new" USING ("kind"::text::"MatchKind_new");
ALTER TYPE "MatchKind" RENAME TO "MatchKind_old";
ALTER TYPE "MatchKind_new" RENAME TO "MatchKind";
DROP TYPE "public"."MatchKind_old";
COMMIT;

-- CreateIndex
CREATE UNIQUE INDEX "babies_playtimeId_finalPlacement_key" ON "babies"("playtimeId", "finalPlacement");

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_playtimeId_fkey" FOREIGN KEY ("playtimeId") REFERENCES "playtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

