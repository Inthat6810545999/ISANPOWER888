ALTER TABLE "users" ADD COLUMN "membershipVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "membership_audit" (
    "id" SERIAL NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousRole" "UserRole" NOT NULL,
    "nextRole" "UserRole" NOT NULL,
    "previousActive" BOOLEAN NOT NULL,
    "nextActive" BOOLEAN NOT NULL,
    "previousMembership" "MembershipStatus" NOT NULL,
    "nextMembership" "MembershipStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membership_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "membership_audit_targetId_id_idx" ON "membership_audit"("targetId", "id");
