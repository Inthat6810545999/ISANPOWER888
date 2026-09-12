CREATE TYPE "UserRole" AS ENUM ('member', 'ta', 'lab_manager');
CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL, "passwordHash" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");
CREATE TABLE "approval_decisions" (
  "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL UNIQUE, "outcome" "ApprovalStatus" NOT NULL,
  "reason" TEXT NOT NULL, "reviewerId" TEXT NOT NULL, "reviewerName" TEXT NOT NULL,
  "reviewerEmail" TEXT NOT NULL, "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "approval_decisions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
