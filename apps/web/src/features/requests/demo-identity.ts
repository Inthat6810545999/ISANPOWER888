import type { Person } from "./types";

// Display labels for existing records and reference fixtures only.
// Authentication and authorization use the verified session, never these constants.
export const DEMO_MEMBER: Person = { id: "member@isanpower.test", name: "Theewasu A.", initials: "TA" };
export const DEMO_TA: Person = { id: "ta@isanpower.test", name: "Kantee L.", initials: "KL" };

export function personFromEmail(email: string): Person {
  if (email === DEMO_MEMBER.id) return DEMO_MEMBER;
  if (email === DEMO_TA.id) return DEMO_TA;
  if (email === "ta2@isanpower.test") return { id: email, name: "Tanon L.", initials: "TL" };
  return { id: email, name: email, initials: email.slice(0, 2).toUpperCase() };
}
