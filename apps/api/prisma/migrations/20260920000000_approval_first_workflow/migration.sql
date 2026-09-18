-- Stop the API before applying: all open work is returned for fresh review.
-- Prior decisions remain auditable; closed/cancelled requests remain unchanged.
BEGIN;
ALTER TABLE "approval_decisions" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "approval_decisions" DROP CONSTRAINT "approval_decisions_requestId_key";
CREATE INDEX "approval_decisions_requestId_idx" ON "approval_decisions"("requestId");
CREATE UNIQUE INDEX "approval_decisions_current_key" ON "approval_decisions"("requestId") WHERE "supersededAt" IS NULL;

UPDATE "approval_decisions" AS d
SET "supersededAt" = CURRENT_TIMESTAMP
FROM "lab_requests" AS r
WHERE d."requestId" = r."id" AND r."status" NOT IN ('closed', 'cancelled');

UPDATE "lab_requests"
SET "requiresApproval" = true, "approvalStatus" = 'submitted', "status" = 'pending',
    "assigneeEmail" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" NOT IN ('closed', 'cancelled');

ALTER TABLE "lab_requests" ALTER COLUMN "requiresApproval" SET DEFAULT true;
ALTER TABLE "lab_requests" ALTER COLUMN "approvalStatus" SET DEFAULT 'submitted';
COMMIT;
