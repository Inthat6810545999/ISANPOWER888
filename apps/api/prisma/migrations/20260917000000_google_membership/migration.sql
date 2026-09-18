CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED');
ALTER TABLE "users" ADD COLUMN "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'APPROVED';
-- Preserve existing access; every subsequently created account starts pending.
ALTER TABLE "users" ALTER COLUMN "membershipStatus" SET DEFAULT 'PENDING';
ALTER TABLE "users" ADD COLUMN "googleSubject" TEXT;
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'unassigned';
CREATE UNIQUE INDEX "users_googleSubject_key" ON "users"("googleSubject");
CREATE TABLE "oauth_attempts" (
  "stateHash" TEXT PRIMARY KEY,
  "bindingHash" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "oauth_attempts_expiresAt_idx" ON "oauth_attempts"("expiresAt");
