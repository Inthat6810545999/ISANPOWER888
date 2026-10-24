import type { Metadata } from "next";
import { VisitorTrack } from "@/features/visitor-track/VisitorTrack";

export const metadata: Metadata = { title: "Track your visit request | ISANPOWER", referrer: "no-referrer" };
export default function VisitTrackPage() { return <VisitorTrack />; }
