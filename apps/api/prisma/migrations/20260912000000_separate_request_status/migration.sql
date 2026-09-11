BEGIN;

-- Preserve the old approval history instead of treating approval as completed work.
ALTER TYPE "RequestStatus" RENAME TO "LegacyApprovalStatus";
CREATE TYPE "ApprovalStatus" AS ENUM ('not_required', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled');
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'assigned', 'in_progress', 'closed', 'cancelled');
CREATE TYPE "RequestPriority" AS ENUM ('low', 'medium', 'high');

ALTER TABLE "lab_requests" RENAME COLUMN "status" TO "approvalStatus";
ALTER TABLE "lab_requests" ALTER COLUMN "approvalStatus" DROP DEFAULT;
ALTER TABLE "lab_requests" ALTER COLUMN "approvalStatus" TYPE "ApprovalStatus"
  USING ("approvalStatus"::text::"ApprovalStatus");
ALTER TABLE "lab_requests" ALTER COLUMN "approvalStatus" SET DEFAULT 'not_required';
DROP TYPE "LegacyApprovalStatus";

ALTER TABLE "lab_requests"
  ADD COLUMN "status" "RequestStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "priority" "RequestPriority" NOT NULL DEFAULT 'medium',
  ADD COLUMN "location" TEXT NOT NULL DEFAULT '';

-- The legacy API had only approval status and no approval flag. Retain its
-- approval workflow for existing rows; only new requests can opt out.
UPDATE "lab_requests" SET "requiresApproval" = true;
UPDATE "lab_requests" SET "status" = 'cancelled' WHERE "approvalStatus" = 'cancelled';

COMMIT;
