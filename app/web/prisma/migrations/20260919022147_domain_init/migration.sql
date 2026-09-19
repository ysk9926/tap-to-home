/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'blocked');

-- CreateEnum
CREATE TYPE "SignalLevel" AS ENUM ('normal', 'strong', 'urgent', 'rescue');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "displayUsername" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_run" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runDate" DATE NOT NULL,
    "tapCount" INTEGER NOT NULL DEFAULT 0,
    "stage" SMALLINT NOT NULL DEFAULT 0,
    "firstTapAt" TIMESTAMP(3),
    "lastTapAt" TIMESTAMP(3),

    CONSTRAINT "daily_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tap_event" (
    "id" BIGSERIAL NOT NULL,
    "dailyRunId" TEXT NOT NULL,
    "tappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchSize" SMALLINT NOT NULL,

    CONSTRAINT "tap_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "level" "SignalLevel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_title" (
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "firstEarnedOn" DATE NOT NULL,
    "earnedCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_title_pkey" PRIMARY KEY ("userId","titleId")
);

-- CreateTable
CREATE TABLE "daily_result" (
    "dailyRunId" TEXT NOT NULL,
    "primaryTitleId" TEXT,
    "titleIds" TEXT[],
    "rank" INTEGER NOT NULL,
    "rankTotal" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_result_pkey" PRIMARY KEY ("dailyRunId")
);

-- CreateIndex
CREATE INDEX "friendship_addresseeId_idx" ON "friendship"("addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "friendship_requesterId_addresseeId_key" ON "friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "daily_run_runDate_idx" ON "daily_run"("runDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_run_userId_runDate_key" ON "daily_run"("userId", "runDate");

-- CreateIndex
CREATE INDEX "tap_event_dailyRunId_idx" ON "tap_event"("dailyRunId");

-- CreateIndex
CREATE INDEX "signal_receiverId_sentAt_idx" ON "signal"("receiverId", "sentAt");

-- CreateIndex
CREATE INDEX "signal_senderId_receiverId_level_sentAt_idx" ON "signal"("senderId", "receiverId", "level", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_run" ADD CONSTRAINT "daily_run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tap_event" ADD CONSTRAINT "tap_event_dailyRunId_fkey" FOREIGN KEY ("dailyRunId") REFERENCES "daily_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_title" ADD CONSTRAINT "user_title_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_result" ADD CONSTRAINT "daily_result_dailyRunId_fkey" FOREIGN KEY ("dailyRunId") REFERENCES "daily_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
