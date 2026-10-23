export function canEditPublicMessage(request: { source?: string; approvalStatus: string }) {
  return request.source === "visitor" && (request.approvalStatus === "approved" || request.approvalStatus === "rejected");
}
