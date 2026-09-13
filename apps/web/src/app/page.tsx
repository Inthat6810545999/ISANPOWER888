import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/session";
import { roleHome } from "@/lib/session-types";
export default async function Home() {
  const user = await sessionUser();
  redirect(user ? roleHome[user.role] : "/login");
}
