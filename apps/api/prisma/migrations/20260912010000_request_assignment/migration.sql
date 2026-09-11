ALTER TABLE "lab_requests" ADD COLUMN "assigneeEmail" TEXT;
CREATE INDEX "lab_requests_requesterEmail_idx" ON "lab_requests"("requesterEmail");
CREATE INDEX "lab_requests_assigneeEmail_status_idx" ON "lab_requests"("assigneeEmail", "status");
