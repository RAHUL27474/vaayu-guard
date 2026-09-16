import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/devices");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">VaayuGuard sign in</h1>
      <LoginForm />
    </div>
  );
}
