import type { Metadata } from "next";
import { VisitorTrack } from "@/features/visitor-track/VisitorTrack";
export const metadata: Metadata = { title: "Track your collaboration request | ISANPOWER", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function CollaborationTrackPage() { return <VisitorTrack collaboration />; }
