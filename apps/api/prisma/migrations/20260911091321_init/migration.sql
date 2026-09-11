-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('equipment', 'space', 'consumable', 'access', 'visitor', 'general');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('submitted', 'under_review', 'approved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "lab_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'submitted',
    "requesterEmail" TEXT NOT NULL,
    "neededBy" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_requests_pkey" PRIMARY KEY ("id")
);
