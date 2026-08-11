-- Remove PlaytimeStatus.DRAFT — every playtime starts directly in
-- NURSERY_OPEN now, no separate admin-triggered "open the nursery" step.
-- Postgres has no ALTER TYPE ... DROP VALUE, so the enum is recreated.

-- Move any existing DRAFT rows to NURSERY_OPEN first.
UPDATE "playtimes" SET "status" = 'NURSERY_OPEN' WHERE "status" = 'DRAFT';

CREATE TYPE "PlaytimeStatus_new" AS ENUM ('NURSERY_OPEN', 'IN_PROGRESS', 'COMPLETE');
ALTER TABLE "playtimes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "playtimes" ALTER COLUMN "status" TYPE "PlaytimeStatus_new" USING ("status"::text::"PlaytimeStatus_new");
ALTER TABLE "playtimes" ALTER COLUMN "status" SET DEFAULT 'NURSERY_OPEN';
DROP TYPE "PlaytimeStatus";
ALTER TYPE "PlaytimeStatus_new" RENAME TO "PlaytimeStatus";
