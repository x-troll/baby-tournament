-- Short DB-backed magic-link exchange token, replacing the signed JWT
-- (which couldn't be meaningfully shortened while staying self-contained).
ALTER TABLE "babies" ADD COLUMN "magicLinkToken" TEXT;
ALTER TABLE "babies" ADD COLUMN "magicLinkExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "babies_magicLinkToken_key" ON "babies"("magicLinkToken");
