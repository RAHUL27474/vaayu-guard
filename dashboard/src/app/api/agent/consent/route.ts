import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice } from "@/lib/agent-auth";

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { noticeVersion?: number } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — treat as an unversioned ack for backward compatibility.
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("devices")
    .update({
      consent_acknowledged_at: new Date().toISOString(),
      consent_notice_version: body.noticeVersion ?? null,
    })
    .eq("id", device.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
