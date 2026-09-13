import type { ReactNode } from "react";
import { TaShell } from "@/components/ta/TaShell";
import { RequestsProvider } from "@/features/requests/RequestsProvider";
import { requireUser } from "@/lib/session";
export default async function TaLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("ta");
  return <RequestsProvider key={user.id} user={user} scope="ta"><TaShell>{children}</TaShell></RequestsProvider>;
}
