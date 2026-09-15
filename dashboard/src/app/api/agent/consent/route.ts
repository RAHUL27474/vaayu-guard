import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice } from "@/lib/agent-auth";

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("devices")
    .update({ consent_acknowledged_at: new Date().toISOString() })
    .eq("id", device.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
