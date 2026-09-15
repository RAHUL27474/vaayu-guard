import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/devices");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">VaayuGuard sign in</h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin (director) and superadmin accounts only — no public signup.
      </p>
      <LoginForm />
    </div>
  );
}
