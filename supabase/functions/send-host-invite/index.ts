// @ts-nocheck — Deno runtime, not Node/browser TS
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { invited_email, full_name, company_name, invite_token, member_id } =
      await req.json();

    if (!invited_email || !full_name || !company_name || !invite_token) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM") ?? smtpUser;
    const appUrl = Deno.env.get("APP_URL") ?? "https://evalutease.com";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "Missing SMTP secrets: SMTP_HOST, SMTP_USER, SMTP_PASS" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite link — host clicks this, signs up, gets linked via token
    const inviteLink = `${appUrl}/accept-invite?token=${invite_token}&member_id=${member_id}&email=${encodeURIComponent(invited_email)}`;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587 (STARTTLS)
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `EvaluTease <${fromEmail}>`,
      to: invited_email,
      subject: `You've been invited to join ${company_name} on EvaluTease`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
          <div style="background:linear-gradient(135deg,#6d28d9,#7c3aed);padding:24px 32px;border-radius:12px 12px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:22px;">EvaluTease</h1>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
            <h2 style="color:#111827;font-size:20px;margin-top:0;">You're invited! 🎉</h2>
            <p style="color:#374151;">Hi <strong>${full_name}</strong>,</p>
            <p style="color:#374151;"><strong>${company_name}</strong> has invited you to join as a <strong>Host</strong> on EvaluTease — a platform for creating and managing quizzes and assessments.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${inviteLink}"
                 style="background:#6d28d9;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;">
              If the button doesn't work, copy and paste this link:<br/>
              <a href="${inviteLink}" style="color:#6d28d9;word-break:break-all;">${inviteLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="color:#9ca3af;font-size:12px;margin:0;">EvaluTease — Smart Assessment Platform. If you didn't expect this email, you can safely ignore it.</p>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-host-invite error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
