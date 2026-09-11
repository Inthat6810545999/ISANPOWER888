import type { Person } from "./types";

// Presentation identities, not login or authorization. Replace with sessions
// before deploying outside local development.
export const DEMO_MEMBER: Person = { id: "member@isanpower.test", name: "Theewasu A.", initials: "TA" };
export const DEMO_TA: Person = { id: "ta@isanpower.test", name: "Kantee L.", initials: "KL" };

export function personFromEmail(email: string): Person {
  if (email === DEMO_MEMBER.id) return DEMO_MEMBER;
  if (email === DEMO_TA.id) return DEMO_TA;
  return { id: email, name: email, initials: email.slice(0, 2).toUpperCase() };
}
