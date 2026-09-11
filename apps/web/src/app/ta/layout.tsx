import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TaShell } from "@/components/ta/TaShell";

export const metadata: Metadata = { title: "ISANPOWER888 — TA Console Demo" };

// TODO (US-3): verify the authenticated TA role here before loading real data.
export default function TaLayout({ children }: { children: ReactNode }) {
  return <TaShell>{children}</TaShell>;
}
