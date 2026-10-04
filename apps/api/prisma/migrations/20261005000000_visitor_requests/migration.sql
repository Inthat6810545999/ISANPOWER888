-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('member', 'visitor');

-- AlterTable
ALTER TABLE "lab_requests" ADD COLUMN     "publicMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "source" "RequestSource" NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "visit_details" (
    "requestId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "organization" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "visitorCount" DOUBLE PRECISION NOT NULL,
    "requestedHost" TEXT NOT NULL DEFAULT '',
    "arrangements" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "visit_details_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "visit_tracking_credentials" (
    "requestId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,

    CONSTRAINT "visit_tracking_credentials_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "public_rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_tracking_credentials_codeHash_key" ON "visit_tracking_credentials"("codeHash");

-- CreateIndex
CREATE INDEX "public_rate_limits_expiresAt_idx" ON "public_rate_limits"("expiresAt");

-- AddForeignKey
ALTER TABLE "visit_details" ADD CONSTRAINT "visit_details_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_tracking_credentials" ADD CONSTRAINT "visit_tracking_credentials_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

