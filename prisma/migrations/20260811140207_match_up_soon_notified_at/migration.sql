-- Dedup guard for the new "you're up soon" pre-notice — set once per
-- match so the cascade-triggered re-check (fires on every confirmation
-- anywhere in the playtime) doesn't re-send it repeatedly.
ALTER TABLE "matches" ADD COLUMN "upSoonNotifiedAt" TIMESTAMP(3);
