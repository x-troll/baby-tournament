-- DropIndex
DROP INDEX "babies_telegramChatId_key";

-- CreateIndex
CREATE UNIQUE INDEX "babies_playtimeId_telegramChatId_key" ON "babies"("playtimeId", "telegramChatId");

