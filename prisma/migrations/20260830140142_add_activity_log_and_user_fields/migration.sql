/*
  Warnings:

  - A unique constraint covering the columns `[monitorToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - The required column `monitorToken` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monitorToken" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "subjectType" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "description" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_subjectType_subjectId_idx" ON "ActivityLog"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_monitorToken_key" ON "User"("monitorToken");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
