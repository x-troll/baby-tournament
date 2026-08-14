-- CreateIndex
CREATE INDEX "help_requests_playtimeId_status_idx" ON "help_requests"("playtimeId", "status");

-- CreateIndex
CREATE INDEX "help_requests_status_idx" ON "help_requests"("status");

-- CreateIndex
CREATE INDEX "match_participants_babyId_idx" ON "match_participants"("babyId");

-- CreateIndex
CREATE INDEX "matches_playtimeId_idx" ON "matches"("playtimeId");
