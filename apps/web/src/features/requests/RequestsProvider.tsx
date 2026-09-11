"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { changeTaRequest, loadRequests, submitRequest } from "./actions";
import type { RequestDraft, WorkspaceRequest } from "./types";

type RequestsContextValue = {
  requests: WorkspaceRequest[];
  addRequest: (draft: RequestDraft) => Promise<void>;
  taAction: (id: string, action: "claim" | "start" | "close") => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
  refreshing: boolean;
  error: string;
  notice: string;
  dismissNotice: () => void;
};
const RequestsContext = createContext<RequestsContextValue | null>(null);

export function RequestsProvider({ children, scope = "member" }: { children: ReactNode; scope?: "member" | "ta" }) {
  const [requests, setRequests] = useState<WorkspaceRequest[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const active = useRef(true);
  const fetching = useRef(false);
  const path = usePathname();

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const version = generation.current;
    setRefreshing(true);
    try {
      const result = await loadRequests(scope);
      if (!active.current || version !== generation.current) return;
      if (result.ok) { setRequests(result.data); setError(""); }
      else setError(result.error);
    } catch {
      if (active.current && version === generation.current) setError("Unable to refresh requests. Check your connection and retry.");
    } finally {
      fetching.current = false;
      if (active.current) { setLoading(false); setRefreshing(false); }
    }
  }, [scope]);

  useEffect(() => {
    active.current = true;
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(onFocus, 4000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active.current = false;
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, path]);

  function saved(request: WorkspaceRequest, message: string) {
    // Ignore any list response that started before this write finished.
    generation.current += 1;
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    setError("");
    setNotice(message);
  }

  async function addRequest(draft: RequestDraft) {
    setNotice("");
    const result = await submitRequest(draft);
    if (!result.ok) throw new Error(result.error);
    saved(result.data, "Request saved. Your TA can now see it in the queue.");
  }

  async function taAction(id: string, action: "claim" | "start" | "close") {
    setNotice("");
    const result = await changeTaRequest(id, action);
    if (!result.ok) { void refresh(); throw new Error(result.error); }
    saved(result.data, action === "claim" ? "Request assigned to you." : action === "start" ? "Work started. The member can see the updated status." : "Request closed. The member can see the updated status.");
  }

  return <RequestsContext.Provider value={{ requests, addRequest, taAction, refresh, loading, refreshing, error, notice, dismissNotice: () => setNotice("") }}>
    {children}
  </RequestsContext.Provider>;
}

export function useRequests() {
  const context = useContext(RequestsContext);
  if (!context) throw new Error("useRequests must be used within RequestsProvider");
  return context;
}
