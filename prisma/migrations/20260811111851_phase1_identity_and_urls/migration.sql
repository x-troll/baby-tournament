-- RenameColumn: Admin.email -> Admin.username (same login credential, new
-- name/meaning — a single organizer identity, not an email address).
ALTER TABLE "admins" RENAME COLUMN "email" TO "username";
ALTER INDEX "admins_email_key" RENAME TO "admins_username_key";

-- Playtime.slug (kebab-name + random suffix) -> Playtime.slugNumber
-- (sequential autoincrement) — every baby/spectator-facing URL now reads
-- /live/<n> or /play/<n> instead of /live/<name>-<hash>. Existing rows get
-- fresh numbers in insertion order; nothing preserves the old slug value.
ALTER TABLE "playtimes" DROP COLUMN "slug";
ALTER TABLE "playtimes" ADD COLUMN "slugNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "playtimes_slugNumber_key" ON "playtimes"("slugNumber");

-- Playtime.joinToken / Admin.adminLinkToken drop their Prisma-side
-- @default(cuid()) — cuid() is generated client-side by Prisma, not a
-- Postgres column default, so there is no DEFAULT expression to drop here;
-- application code (src/lib/short-id.ts) now supplies these values
-- explicitly at insert time instead.
