import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateDevice } from "@/lib/agent-auth";
import type { Database } from "@/lib/types/database";

type IncomingEvent = {
  capturedAt: string;
  processName: string;
  windowTitle: string;
  channel: Database["public"]["Enums"]["activity_channel"];
  detectedIdentity?: string | null;
  isMismatch?: boolean;
  confidence?: Database["public"]["Enums"]["event_confidence"];
};

const MAX_EVENTS_PER_BATCH = 200;

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { events?: IncomingEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const events = (body.events ?? []).slice(0, MAX_EVENTS_PER_BATCH);
  const supabase = createAdminClient();

  if (events.length > 0) {
    const { error: insertError } = await supabase.from("activity_events").insert(
      events.map((e) => ({
        device_id: device.id,
        captured_at: e.capturedAt,
        process_name: e.processName,
        window_title: e.windowTitle,
        channel: e.channel,
        detected_identity: e.detectedIdentity ?? null,
        is_mismatch: e.isMismatch ?? false,
        confidence: e.confidence ?? "high",
      }))
    );
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Fold mismatches into the denormalized `alerts` surface — one open row
    // per (device, identity), so the dashboard doesn't aggregate raw events.
    for (const e of events) {
      if (!e.isMismatch || !e.detectedIdentity) continue;

      const { data: existing } = await supabase
        .from("alerts")
        .select("id, occurrence_count")
        .eq("device_id", device.id)
        .eq("detected_identity", e.detectedIdentity)
        .eq("status", "open")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("alerts")
          .update({
            last_seen_at: e.capturedAt,
            occurrence_count: existing.occurrence_count + 1,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("alerts").insert({
          device_id: device.id,
          first_seen_at: e.capturedAt,
          last_seen_at: e.capturedAt,
          detected_identity: e.detectedIdentity,
          channel: e.channel,
        });
      }
    }
  }

  await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);

  // Echo back the current assignment/status so the agent stays in sync if
  // the admin changes it later, without needing a reinstall.
  return NextResponse.json({
    ok: true,
    accepted: events.length,
    assignedEmail: device.assigned_email,
    status: device.status,
  });
}
