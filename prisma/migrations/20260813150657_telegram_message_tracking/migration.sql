-- AlterTable
ALTER TABLE "help_requests" ADD COLUMN     "telegramMessages" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "readyCheckMessages" JSONB NOT NULL DEFAULT '[]';
