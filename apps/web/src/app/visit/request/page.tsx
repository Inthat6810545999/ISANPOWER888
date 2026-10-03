import type { Metadata } from "next";
import { VisitorRequest } from "@/features/visitor-request/VisitorRequest";

export const metadata: Metadata = { title: "Request a lab visit | ISANPOWER" };
export default function VisitRequestPage() { return <VisitorRequest />; }
