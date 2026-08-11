-- Revert per-baby organizer-term customization; add explicit-messages opt-in.
ALTER TABLE "babies" DROP COLUMN "organizerRoleLabel";
ALTER TABLE "babies" ADD COLUMN "allowExplicitMessages" BOOLEAN NOT NULL DEFAULT false;
