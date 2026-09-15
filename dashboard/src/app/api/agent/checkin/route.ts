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
  isForeground?: boolean;
};

type IncomingWindowActivity = {
  capturedAt: string;
  processName: string;
  windowTitle: string;
  isForeground?: boolean;
};

const MAX_EVENTS_PER_BATCH = 200;
const MAX_WINDOW_ACTIVITY_PER_BATCH = 500;

// How much gap between two sightings of the same identity counts as "the
// same continuous session" vs. "it was closed and reopened". Comfortably
// larger than the agent's default 45s poll interval so a couple of missed
// polls don't fragment one real session into several.
const SESSION_GAP_MS = 5 * 60 * 1000;

function isTrackable(e: IncomingEvent): e is IncomingEvent & { detectedIdentity: string } {
  return !!e.detectedIdentity && (e.isMismatch === true || e.channel === "whatsapp");
}

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { events?: IncomingEvent[]; windowActivity?: IncomingWindowActivity[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const events = (body.events ?? []).slice(0, MAX_EVENTS_PER_BATCH);
  const windowActivity = (body.windowActivity ?? []).slice(0, MAX_WINDOW_ACTIVITY_PER_BATCH);
  const supabase = createAdminClient();

  if (windowActivity.length > 0) {
    await supabase.from("window_activity").insert(
      windowActivity.map((w) => ({
        device_id: device.id,
        captured_at: w.capturedAt,
        process_name: w.processName,
        window_title: w.windowTitle,
        is_foreground: w.isForeground ?? false,
      }))
    );
  }

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
        is_foreground: e.isForeground ?? false,
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

    await syncSessions(supabase, device.id, events);
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

/**
 * Turns a batch of raw sightings into open/closed sessions: when a
 * mismatched (or WhatsApp) identity was first seen, when it was last seen,
 * how many polls it appeared in, and how many of those it was the
 * foreground window. Only tracks identities worth tracking — the assigned
 * (correct) email is never session-tracked, keeping this narrow to the
 * same non-assigned-identity signal the rest of the app surfaces.
 */
async function syncSessions(
  supabase: ReturnType<typeof createAdminClient>,
  deviceId: string,
  events: IncomingEvent[]
) {
  const trackable = events.filter(isTrackable).sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );

  const { data: openSessions } = await supabase
    .from("sessions")
    .select("id, detected_identity, last_seen_at, total_hits, foreground_hits")
    .eq("device_id", deviceId)
    .is("ended_at", null);

  const open = new Map((openSessions ?? []).map((s) => [s.detected_identity, s]));
  const touched = new Set<string>();

  for (const e of trackable) {
    touched.add(e.detectedIdentity);
    const current = open.get(e.detectedIdentity);
    const capturedAt = new Date(e.capturedAt).toISOString();

    if (!current) {
      const { data: inserted } = await supabase
        .from("sessions")
        .insert({
          device_id: deviceId,
          detected_identity: e.detectedIdentity,
          channel: e.channel,
          started_at: capturedAt,
          last_seen_at: capturedAt,
          total_hits: 1,
          foreground_hits: e.isForeground ? 1 : 0,
        })
        .select("id, detected_identity, last_seen_at, total_hits, foreground_hits")
        .single();
      if (inserted) open.set(e.detectedIdentity, inserted);
      continue;
    }

    const gap = new Date(capturedAt).getTime() - new Date(current.last_seen_at).getTime();
    if (gap > SESSION_GAP_MS) {
      // Too long a silence — treat the old sighting as closed and start a
      // fresh session rather than stretching one across the gap.
      await supabase
        .from("sessions")
        .update({ ended_at: current.last_seen_at })
        .eq("id", current.id);

      const { data: inserted } = await supabase
        .from("sessions")
        .insert({
          device_id: deviceId,
          detected_identity: e.detectedIdentity,
          channel: e.channel,
          started_at: capturedAt,
          last_seen_at: capturedAt,
          total_hits: 1,
          foreground_hits: e.isForeground ? 1 : 0,
        })
        .select("id, detected_identity, last_seen_at, total_hits, foreground_hits")
        .single();
      if (inserted) open.set(e.detectedIdentity, inserted);
      continue;
    }

    const updated = {
      last_seen_at: capturedAt,
      total_hits: current.total_hits + 1,
      foreground_hits: current.foreground_hits + (e.isForeground ? 1 : 0),
    };
    await supabase.from("sessions").update(updated).eq("id", current.id);
    open.set(e.detectedIdentity, { ...current, ...updated });
  }

  // Any session left open that this batch never touched, and hasn't been
  // heard from in a while, is presumed closed (window/tab was closed).
  const staleCutoff = Date.now() - SESSION_GAP_MS;
  for (const [identity, session] of open) {
    if (touched.has(identity)) continue;
    if (new Date(session.last_seen_at).getTime() > staleCutoff) continue;
    await supabase
      .from("sessions")
      .update({ ended_at: session.last_seen_at })
      .eq("id", session.id);
  }
}
