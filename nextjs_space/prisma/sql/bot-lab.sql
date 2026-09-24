-- Additive migration for installations that currently use prisma db push.
BEGIN;
CREATE TABLE IF NOT EXISTS "PaperBot" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "market" TEXT NOT NULL, "symbol" TEXT NOT NULL, "running" BOOLEAN NOT NULL DEFAULT false,
 "config" JSONB NOT NULL, "state" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
 "checkedAt" TIMESTAMP(3), "message" TEXT NOT NULL DEFAULT 'Henüz başlatılmadı.',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaperBot_userId_market_key" ON "PaperBot"("userId", "market");
CREATE INDEX IF NOT EXISTS "PaperBot_running_idx" ON "PaperBot"("running");
CREATE TABLE IF NOT EXISTS "PaperBotEvent" (
 "id" TEXT PRIMARY KEY, "botId" TEXT NOT NULL REFERENCES "PaperBot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "data" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PaperBotEvent_botId_createdAt_idx" ON "PaperBotEvent"("botId", "createdAt");
COMMIT;
