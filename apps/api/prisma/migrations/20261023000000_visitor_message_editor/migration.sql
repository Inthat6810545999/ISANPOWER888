-- Latest editor snapshots only. Existing messages retain NULL metadata.
ALTER TABLE "lab_requests"
ADD COLUMN "publicMessageUpdatedById" TEXT,
ADD COLUMN "publicMessageUpdatedByName" TEXT,
ADD COLUMN "publicMessageUpdatedByEmail" TEXT,
ADD COLUMN "publicMessageUpdatedAt" TIMESTAMP(3);
