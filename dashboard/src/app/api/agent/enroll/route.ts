import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/device-token";

/**
 * One-time device enrollment. The admin issues a single-use enrollment
 * token via the dashboard; the agent's installer exchanges it here for a
 * long-lived device bearer token used on every later call.
 */
export async function POST(request: Request) {
  let body: { token?: string; hostname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: device, error } = await supabase
    .from("devices")
    .select("id, status, assigned_email")
    .eq("enrollment_token_hash", hashToken(token))
    .eq("status", "pending")
    .single();

  if (error || !device) {
    return NextResponse.json(
      { error: "Invalid or already-used enrollment token" },
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
  });
}
