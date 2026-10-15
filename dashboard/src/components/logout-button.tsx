import { logout } from "@/lib/actions/auth-actions";

// A plain form posting to a server action — no client JS, and no browser-side
// Supabase client shipped to every signed-in page just for this button.
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border border-line-strong px-2 py-1 text-fg-2 hover:bg-surface-2"
      >
        Logout
      </button>
    </form>
  );
}
