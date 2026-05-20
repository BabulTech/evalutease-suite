// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

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

function reminderHtml(recipientName: string, quizTitle: string, scheduledAt: string, accessCode: string, joinUrl: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%);padding:28px 36px;border-radius:14px 14px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">EvaluTease</h1>
    <p style="margin:4px 0 0;color:#ede9fe;font-size:13px;">Smart Assessment Platform</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:36px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;">
    <h2 style="margin-top:0;color:#d97706;font-size:22px;">⏰ Quiz starting in 5 minutes!</h2>
    <p style="color:#374151;line-height:1.7;">Hi <strong>${recipientName}</strong>,</p>
    <p style="color:#374151;line-height:1.7;">Get ready — <strong>${quizTitle}</strong> is about to begin at <strong>${scheduledAt}</strong>.</p>
    <table width="100%" cellpadding="10" style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;margin:20px 0;font-size:14px;">
      <tr><td style="color:#6b7280;width:140px;">Access Code</td>
      <td style="color:#6d28d9;font-weight:900;font-size:20px;letter-spacing:3px;">${accessCode}</td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${joinUrl}" style="background:#6d28d9;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Join Now →</a>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center;">Or open: <a href="${joinUrl}" style="color:#6d28d9;">${joinUrl}</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL") ?? "https://evalutease-suite.vercel.app";

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM") ?? smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return Response.json({ ok: false, error: "Missing SMTP secrets" }, { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const windowStart = new Date(now.getTime() + 3 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() + 7 * 60 * 1000).toISOString();

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

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    let totalSent = 0;

    for (const session of sessions) {
      const { data: rows } = await supabase
        .from("quiz_session_participants")
        .select("participants(name, email)")
        .eq("session_id", session.id);

      const recipients = (rows ?? [])
        .map((r: any) => Array.isArray(r.participants) ? r.participants[0] : r.participants)
        .filter((p: any) => p?.email);

      console.log(`[quiz-reminders] session ${session.id}: ${recipients.length} recipients`);

      if (recipients.length === 0) continue;

      const joinUrl = `${appUrl}/q/${session.access_code}`;
      const scheduledAtFormatted = formatScheduledAt(session.scheduled_at);

      let sessionSent = 0;
      for (const p of recipients) {
        try {
          await transporter.sendMail({
            from: `EvaluTease <${fromEmail}>`,
            to: p.email,
            subject: `⏰ Starting in 5 min: ${session.title}`,
            html: reminderHtml(p.name ?? "Participant", session.title, scheduledAtFormatted, session.access_code, joinUrl),
          });
          console.log(`[quiz-reminders] sent to ${p.email}`);
          sessionSent++;
          totalSent++;
        } catch (e) {
          console.error(`[quiz-reminders] SMTP failed for ${p.email}:`, e instanceof Error ? e.message : String(e));
        }
      }

      if (sessionSent > 0) {
        await supabase.from("quiz_sessions").update({ reminder_sent: true }).eq("id", session.id);
      }
    }

    console.log(`[quiz-reminders] sent ${totalSent} reminder emails`);
    return Response.json({ ok: true, sent: totalSent }, { headers: corsHeaders });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[quiz-reminders] error:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500, headers: corsHeaders });
  }
});
