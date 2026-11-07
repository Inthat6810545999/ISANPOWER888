-- Additive migration: existing requests and approval records are unchanged.
-- Do not invent historical actors or transition timestamps for existing requests.
CREATE TYPE "RequestHistoryAction" AS ENUM ('created', 'claimed', 'started', 'closed');
CREATE TABLE "request_history" (
  "id" SERIAL NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" "RequestHistoryAction" NOT NULL,
  "fromStatus" "RequestStatus",
  "toStatus" "RequestStatus" NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "request_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "request_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "request_history_requestId_occurredAt_id_idx" ON "request_history"("requestId", "occurredAt", "id");
