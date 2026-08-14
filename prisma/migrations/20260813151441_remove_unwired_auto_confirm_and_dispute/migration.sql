/*
  Warnings:

  - The values [REPORTED,AUTO_CONFIRMED,DISPUTED] on the enum `MatchEventType` will be removed. If these variants are still used in the database, this will fail.
  - The values [REPORTED] on the enum `MatchStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `deadlineAt` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `disputed` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `rollingAvgMatchDurationSec` on the `playtimes` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MatchEventType_new" AS ENUM ('CREATED', 'READY', 'STARTED', 'CONFIRMED', 'FORFEITED', 'OVERRIDDEN', 'UNDONE');
ALTER TABLE "match_events" ALTER COLUMN "type" TYPE "MatchEventType_new" USING ("type"::text::"MatchEventType_new");
ALTER TYPE "MatchEventType" RENAME TO "MatchEventType_old";
ALTER TYPE "MatchEventType_new" RENAME TO "MatchEventType";
DROP TYPE "public"."MatchEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MatchStatus_new" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'CONFIRMED');
ALTER TABLE "public"."matches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "matches" ALTER COLUMN "status" TYPE "MatchStatus_new" USING ("status"::text::"MatchStatus_new");
ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
ALTER TYPE "MatchStatus_new" RENAME TO "MatchStatus";
DROP TYPE "public"."MatchStatus_old";
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "deadlineAt",
DROP COLUMN "disputed";

-- AlterTable
ALTER TABLE "playtimes" DROP COLUMN "rollingAvgMatchDurationSec";
