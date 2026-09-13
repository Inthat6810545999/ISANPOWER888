import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RequestsProvider } from "@/features/requests/RequestsProvider";
import { requireUser } from "@/lib/session";
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("member");
  return <RequestsProvider key={user.id} user={user}><WorkspaceShell>{children}</WorkspaceShell></RequestsProvider>;
}
