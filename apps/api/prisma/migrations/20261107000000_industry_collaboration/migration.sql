-- Additive only: existing requests, decisions and accounts are preserved.
ALTER TYPE "RequestType" ADD VALUE 'industry_collaboration';
ALTER TYPE "RequestSource" ADD VALUE 'industry_collaboration';

CREATE TABLE "industry_collaborations" (
  "requestId" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "submittedById" TEXT NOT NULL,
  "submittedByName" TEXT NOT NULL,
  "submittedByEmail" TEXT NOT NULL,
  CONSTRAINT "industry_collaborations_pkey" PRIMARY KEY ("requestId"),
  CONSTRAINT "industry_collaborations_requestId_fkey" FOREIGN KEY ("requestId")
    REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
