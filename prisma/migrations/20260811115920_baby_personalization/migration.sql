-- Optional per-baby personalization: an avatar pick and custom terms for
-- what to call the organizer / what to be called — all nullable, all
-- default to "unset" (deployment default applies until a baby picks
-- something via Telegram's /profile command or the web settings page).
ALTER TABLE "babies" ADD COLUMN "avatarId" TEXT;
ALTER TABLE "babies" ADD COLUMN "organizerRoleLabel" TEXT;
ALTER TABLE "babies" ADD COLUMN "selfRoleLabel" TEXT;
