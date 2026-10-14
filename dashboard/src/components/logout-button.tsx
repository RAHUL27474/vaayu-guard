import { logout } from "@/lib/actions/auth-actions";

// A plain form posting to a server action — no client JS, and no browser-side
// Supabase client shipped to every signed-in page just for this button.
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
      >
        Logout
      </button>
    </form>
  );
}
