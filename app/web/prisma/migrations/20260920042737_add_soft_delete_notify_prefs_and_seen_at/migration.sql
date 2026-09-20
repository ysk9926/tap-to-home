-- AlterTable
ALTER TABLE "daily_result" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "notifySettlement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySignal" BOOLEAN NOT NULL DEFAULT true;
