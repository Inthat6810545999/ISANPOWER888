import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RequestsProvider } from "@/features/requests/RequestsProvider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <RequestsProvider><WorkspaceShell>{children}</WorkspaceShell></RequestsProvider>;
}
