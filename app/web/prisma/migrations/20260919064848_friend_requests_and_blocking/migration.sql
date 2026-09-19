-- AlterTable
ALTER TABLE "friendship" ADD COLUMN     "blockedById" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "friendship_blockedById_idx" ON "friendship"("blockedById");

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
