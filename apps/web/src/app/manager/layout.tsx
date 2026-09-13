import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { RequestsProvider } from "@/features/requests/RequestsProvider";
import { ManagerShell } from "@/components/manager/ManagerShell";
export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("lab_manager");
  return <RequestsProvider key={user.id} user={user} scope="lab_manager"><ManagerShell>{children}</ManagerShell></RequestsProvider>;
}
