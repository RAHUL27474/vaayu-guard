import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSessionUser();
  redirect(session ? "/devices" : "/login");
}
