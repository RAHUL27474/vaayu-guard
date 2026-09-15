/**
 * Public Supabase connection config for VaayuGuard's OWN, separate Supabase
 * project — deliberately never falls back to a hardcoded value, so a missing
 * env var fails loudly instead of silently pointing at the wrong project.
 */
// Functions, not top-level constants: Next.js imports every route module
// during `next build`'s page-data-collection step regardless of whether the
// route is ever invoked, so a top-level throw here would fail the build for
// anyone without .env.local configured yet. Evaluating lazily means the
// error only surfaces when a request actually needs Supabase.
//
// Each `process.env.NEXT_PUBLIC_*` reference below must stay a literal
// property access (not a dynamic `process.env[name]` lookup) — Next's
// bundler only inlines the literal form into client-side bundles.

export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local and fill in this VaayuGuard project's own Supabase URL/key."
    );
  }
  return value;
}

export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env.local and fill in this VaayuGuard project's own Supabase URL/key."
    );
  }
  return value;
}
