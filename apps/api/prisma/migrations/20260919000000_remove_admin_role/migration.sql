BEGIN;

-- Preserve former administrator accounts, but require fresh membership approval.
-- Revoke existing sessions before removing their internal access.
DELETE FROM "sessions" WHERE "userId" IN (
  SELECT "id" FROM "users" WHERE "role"::text = 'admin'
);
UPDATE "users"
SET "role" = 'unassigned', "membershipStatus" = 'PENDING',
    "membershipApprovedBy" = NULL, "membershipApprovedAt" = NULL
WHERE "role"::text = 'admin';

-- PostgreSQL cannot drop a single enum value; replace the type atomically.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "UserRole" RENAME TO "UserRole_retired";
CREATE TYPE "UserRole" AS ENUM ('unassigned', 'member', 'ta', 'lab_manager');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'unassigned';
DROP TYPE "UserRole_retired";

COMMIT;
