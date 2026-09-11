"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MOCK_MEMBER, MOCK_REQUESTS } from "./mock-data";
import type { RequestDraft, WorkspaceRequest } from "./types";

type RequestsContextValue = {
  requests: WorkspaceRequest[];
  addRequest: (draft: RequestDraft) => void;
  notice: string;
  dismissNotice: () => void;
};
const RequestsContext = createContext<RequestsContextValue | null>(null);

/** Session-only demo store; replace through a shared integration PR. */
export function RequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<WorkspaceRequest[]>(MOCK_REQUESTS);
  const [notice, setNotice] = useState("");

  function addRequest(draft: RequestDraft) {
    const createdAt = new Date().toISOString();
    setRequests((current) => {
      const nextNumber = Math.max(...current.map((request) => Number(request.id.slice(4)))) + 1;
      return [{ ...draft, id: `LAB-${String(nextNumber).padStart(4, "0")}`, status: "pending",
        requester: MOCK_MEMBER, assignee: null, createdAt }, ...current];
    });
    setNotice("Request added to this demo session. Your team’s next step starts here.");
  }

  return <RequestsContext.Provider value={{ requests, addRequest, notice, dismissNotice: () => setNotice("") }}>
    {children}
  </RequestsContext.Provider>;
}

export function useRequests() {
  const context = useContext(RequestsContext);
  if (!context) throw new Error("useRequests must be used within RequestsProvider");
  return context;
}
