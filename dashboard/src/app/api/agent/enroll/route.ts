import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/device-token";

/**
 * One-time device enrollment, two ways in:
 *
 * 1. By token — the admin issues a single-use random token via the
 *    dashboard; the old install.ps1 flow pastes it in explicitly.
 * 2. By email — the single-file installer just asks the CRE for their
 *    assigned company email and matches it against a *pending* device the
 *    superadmin already created. Simpler for the CRE, but the email is a
 *    weaker secret than a random token: it works because only a device the
 *    superadmin explicitly created and left `pending` can ever match, and
 *    a real install (physical/organizational access to the company PC) is
 *    already required to run the installer in the first place. Acceptable
 *    for an ~11-PC internal pilot; revisit if that assumption changes.
 *
 * Either way, this exchanges for a long-lived device bearer token used on
 * every later call.
 */
export async function POST(request: Request) {
  let body: { token?: string; email?: string; hostname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const email = body.email?.trim();
  if (!token && !email) {
    return NextResponse.json({ error: "Missing token or email" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const query = supabase
    .from("devices")
    .select("id, status, assigned_email, assigned_phone")
    .eq("status", "pending");

  const { data: device, error } = token
    ? await query.eq("enrollment_token_hash", hashToken(token)).single()
    : await query.ilike("assigned_email", email!).single();

  if (error || !device) {
    return NextResponse.json(
      {
        error: token
          ? "Invalid or already-used enrollment token"
          : "No pending device found for this email — ask your admin to add this PC first",
      },
      { status: 401 }
    );
  }

  const deviceToken = generateToken();
  const { error: updateError } = await supabase
    .from("devices")
    .update({
      hostname: body.hostname?.slice(0, 255) ?? null,
      active_token_hash: hashToken(deviceToken),
      status: "active",
      enrollment_token_used_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    deviceId: device.id,
    deviceToken,
    assignedEmail: device.assigned_email,
    assignedPhone: device.assigned_phone,
  });
}
