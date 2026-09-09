-- AlterTable
ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "autoExit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "buyCommissionTry" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "executionReason" TEXT,
ADD COLUMN IF NOT EXISTS "fxPnlTry" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "pricePnlTry" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TradeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "requestId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '/portfolio',
    "readAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReplaySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplaySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TradeRequest_userId_requestId_key" ON "TradeRequest"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppNotification_eventKey_key" ON "AppNotification"("eventKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppNotification_userId_createdAt_idx" ON "AppNotification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReplaySession_userId_createdAt_idx" ON "ReplaySession"("userId", "createdAt");


CREATE INDEX IF NOT EXISTS "AppNotification_pushedAt_createdAt_idx" ON "AppNotification"("pushedAt", "createdAt");

CREATE TABLE IF NOT EXISTS "AiContentReport" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "comment" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiContentReport_userId_fingerprint_key" ON "AiContentReport"("userId", "fingerprint");
CREATE INDEX IF NOT EXISTS "AiContentReport_status_createdAt_idx" ON "AiContentReport"("status", "createdAt");
