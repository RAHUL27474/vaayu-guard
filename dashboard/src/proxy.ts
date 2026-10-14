import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Agent API routes authenticate with their own device token, and static
    // files (agent manifest, extension .crx/update.xml) need no session —
    // skipping them avoids an auth check on every agent check-in.
    "/((?!_next/static|_next/image|api/agent|agent/|extension/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|xml|crx|exe)$).*)",
  ],
};
