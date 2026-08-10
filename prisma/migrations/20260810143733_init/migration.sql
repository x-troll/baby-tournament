-- CreateEnum
CREATE TYPE "Game" AS ENUM ('MARIO_KART', 'SUPER_SMASH');

-- CreateEnum
CREATE TYPE "PlaytimeStatus" AS ENUM ('DRAFT', 'NURSERY_OPEN', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "BabyStatus" AS ENUM ('ACTIVE', 'NAPPED', 'CHAMPION');

-- CreateEnum
CREATE TYPE "MatchKind" AS ENUM ('PLAYPEN', 'QF', 'LOSERS_R1', 'WINNERS_FINAL', 'LOSERS_FINAL', 'GRAND_FINAL', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'REPORTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('CREATED', 'READY', 'STARTED', 'REPORTED', 'CONFIRMED', 'AUTO_CONFIRMED', 'DISPUTED', 'FORFEITED', 'OVERRIDDEN', 'UNDONE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('BABY', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "HelpStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "adminLinkToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playtimes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "game" "Game" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PlaytimeStatus" NOT NULL DEFAULT 'DRAFT',
    "stationCount" INTEGER NOT NULL DEFAULT 1,
    "defaultMatchDurationSec" INTEGER NOT NULL,
    "rollingAvgMatchDurationSec" INTEGER,
    "rulesOverrideNote" TEXT,
    "joinToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "babies" (
    "id" TEXT NOT NULL,
    "playtimeId" TEXT NOT NULL,
    "displayName" TEXT,
    "telegramChatId" TEXT,
    "registrationOrder" INTEGER NOT NULL,
    "seed" INTEGER,
    "status" "BabyStatus" NOT NULL DEFAULT 'ACTIVE',
    "finalPlacement" INTEGER,
    "lastHelpRequestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "babies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "playtimeId" TEXT NOT NULL,
    "kind" "MatchKind" NOT NULL,
    "round" INTEGER NOT NULL,
    "penIndex" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "stationNumber" INTEGER,
    "deadlineAt" TIMESTAMP(3),
    "reportedById" TEXT,
    "forfeited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "seedInMatch" INTEGER,
    "finishPosition" INTEGER,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" SERIAL NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorBabyId" TEXT,
    "actorAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_requests" (
    "id" TEXT NOT NULL,
    "playtimeId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "matchId" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "HelpStatus" NOT NULL DEFAULT 'OPEN',
    "threadKey" TEXT NOT NULL,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegramChatId_key" ON "admins"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_adminLinkToken_key" ON "admins"("adminLinkToken");

-- CreateIndex
CREATE UNIQUE INDEX "playtimes_slug_key" ON "playtimes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "playtimes_joinToken_key" ON "playtimes"("joinToken");

-- CreateIndex
CREATE UNIQUE INDEX "babies_telegramChatId_key" ON "babies"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "babies_playtimeId_registrationOrder_key" ON "babies"("playtimeId", "registrationOrder");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_matchId_babyId_key" ON "match_participants"("matchId", "babyId");

-- CreateIndex
CREATE INDEX "match_events_matchId_id_idx" ON "match_events"("matchId", "id");

-- AddForeignKey
ALTER TABLE "babies" ADD CONSTRAINT "babies_playtimeId_fkey" FOREIGN KEY ("playtimeId") REFERENCES "playtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_playtimeId_fkey" FOREIGN KEY ("playtimeId") REFERENCES "playtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actorBabyId_fkey" FOREIGN KEY ("actorBabyId") REFERENCES "babies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
