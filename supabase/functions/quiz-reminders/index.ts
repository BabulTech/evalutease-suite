// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatScheduledAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-PK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Karachi",
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL") ?? "https://evalutease-suite.vercel.app";

    const supabase = createClient(supabaseUrl, serviceKey);

    // Sessions scheduled in the next 4–6 minutes with no reminder sent yet
    const now = new Date();
    const windowStart = new Date(now.getTime() + 4 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() + 6 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from("quiz_sessions")
      .select("id, title, access_code, scheduled_at")
      .eq("status", "scheduled")
      .eq("reminder_sent", false)
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd);

    if (error) {
      console.error("[quiz-reminders] DB error:", error.message);
      return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
    }

    if (!sessions?.length) {
      return Response.json({ ok: true, sent: 0 }, { headers: corsHeaders });
    }

    let totalSent = 0;

    for (const session of sessions) {
      // Get all participants with emails in this session's roster
      const { data: rows } = await supabase
        .from("quiz_session_participants")
        .select("participants(name, email)")
        .eq("session_id", session.id);

      const recipients = (rows ?? [])
        .map((r: any) => r.participants)
        .filter((p: any) => p?.email);

      const joinUrl = `${appUrl}/q/${session.access_code}`;
      const scheduledAtFormatted = formatScheduledAt(session.scheduled_at);

      for (const p of recipients) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            type: "quiz_reminder",
            data: {
              to: p.email,
              recipientName: p.name ?? "Participant",
              quizTitle: session.title,
              scheduledAt: scheduledAtFormatted,
              accessCode: session.access_code,
              joinUrl,
            },
          }),
        }).catch((e) => console.error(`[quiz-reminders] email failed for ${p.email}:`, e));

        totalSent++;
      }

      // Mark reminder as sent so we don't re-send
      await supabase
        .from("quiz_sessions")
        .update({ reminder_sent: true })
        .eq("id", session.id);
    }

    console.log(`[quiz-reminders] sent ${totalSent} reminder emails`);
    return Response.json({ ok: true, sent: totalSent }, { headers: corsHeaders });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[quiz-reminders] error:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500, headers: corsHeaders });
  }
});
