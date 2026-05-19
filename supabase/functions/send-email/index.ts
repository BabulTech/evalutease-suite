// @ts-nocheck — Deno runtime
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Shared branded wrapper ──────────────────────────────────
function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%);padding:28px 36px;border-radius:14px 14px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">EvaluTease</h1>
          <p style="margin:4px 0 0;color:#ede9fe;font-size:13px;">Smart Assessment Platform</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:36px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;">
          ${content}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;"/>
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            You're receiving this email because you have an account on EvaluTease.<br/>
            If you didn't expect this, you can safely ignore it.
          </p>
          <!-- Signature -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:2px solid #6d28d9;padding-top:20px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">Warm &amp; Best Regards,</p>
                <p style="margin:0 0 12px;color:#6d28d9;font-size:18px;font-weight:700;letter-spacing:-0.5px;">BabulQ</p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:3px 0;color:#6b7280;font-size:12px;">
                      📞 <a href="tel:+923102700403" style="color:#6b7280;text-decoration:none;">+92 310 2700403</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;color:#6b7280;font-size:12px;">
                      ✉️ <a href="mailto:contact@babultech.com" style="color:#6d28d9;text-decoration:none;">contact@babultech.com</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;color:#6b7280;font-size:12px;">
                      📍 <a href="https://maps.app.goo.gl/68znfMTx4ar17ipD9" style="color:#6d28d9;text-decoration:none;">IDC Office, Islamabad — View on Maps</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding:16px 0;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">© 2025 BabulTech · All rights reserved</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(text: string, href: string) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="background:#6d28d9;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;letter-spacing:0.2px;">${text}</a>
  </div>
  <p style="color:#6b7280;font-size:12px;text-align:center;">Button not working? <a href="${href}" style="color:#6d28d9;word-break:break-all;">${href}</a></p>`;
}

// ─── Email templates ─────────────────────────────────────────
const templates: Record<string, (d: Record<string, string>) => { subject: string; html: string }> = {

  welcome: ({ name, appUrl }) => ({
    subject: "Welcome to EvaluTease 🎉",
    html: layout(`
      <h2 style="margin-top:0;color:#111827;font-size:22px;">Welcome, ${name}! 🎉</h2>
      <p style="color:#374151;line-height:1.7;">Your account is ready. Start creating quizzes, running live sessions, and analysing results — all in one place.</p>
      <ul style="color:#374151;line-height:2;padding-left:20px;">
        <li>Create unlimited questions in your question bank</li>
        <li>Run live or scheduled quiz sessions</li>
        <li>Generate detailed reports and export results</li>
      </ul>
      ${btn("Go to Dashboard", `${appUrl}/dashboard`)}
    `),
  }),

  trial_expiring: ({ name, days, appUrl }) => ({
    subject: `Your Enterprise Trial expires in ${days} day${days === "1" ? "" : "s"}`,
    html: layout(`
      <h2 style="margin-top:0;color:#d97706;font-size:22px;">⏰ Trial ending soon</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">Your Enterprise Trial will expire in <strong>${days} day${days === "1" ? "" : "s"}</strong>. After that, your organisation will move to the <strong>Enterprise Free</strong> plan — AI features will be disabled and limits will apply.</p>
      <p style="color:#374151;line-height:1.7;">Upgrade to <strong>Enterprise Pro</strong> to keep full AI access, unlimited sessions, and premium features.</p>
      ${btn("Upgrade Now", `${appUrl}/billing`)}
    `),
  }),

  trial_expired: ({ name, appUrl }) => ({
    subject: "Your Enterprise Trial has ended",
    html: layout(`
      <h2 style="margin-top:0;color:#dc2626;font-size:22px;">Your trial has ended</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">Your 15-day Enterprise Trial has ended. Your organisation has been moved to the <strong>Enterprise Free</strong> plan.</p>
      <table width="100%" cellpadding="12" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;margin:20px 0;">
        <tr><td style="color:#374151;font-size:14px;">
          <strong>What changed:</strong><br/>
          • AI question generation is now disabled<br/>
          • Daily quiz limit: 3 per day<br/>
          • Up to 3 hosts still active<br/>
          • All your data is safe
        </td></tr>
      </table>
      <p style="color:#374151;line-height:1.7;">Upgrade to <strong>Enterprise Pro</strong> to restore full access.</p>
      ${btn("Upgrade to Enterprise Pro", `${appUrl}/billing`)}
    `),
  }),

  payment_submitted: ({ name, amount, appUrl }) => ({
    subject: "Payment received — under review",
    html: layout(`
      <h2 style="margin-top:0;color:#111827;font-size:22px;">Payment received ✅</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">We've received your payment of <strong>PKR ${amount}</strong>. Our team will verify it within <strong>1–2 business days</strong> and activate your plan automatically.</p>
      <p style="color:#374151;line-height:1.7;">You'll receive a confirmation email as soon as it's approved.</p>
      ${btn("View Billing", `${appUrl}/billing`)}
    `),
  }),

  payment_approved: ({ name, planName, appUrl }) => ({
    subject: "Payment approved — plan activated 🎉",
    html: layout(`
      <h2 style="margin-top:0;color:#16a34a;font-size:22px;">Payment approved! 🎉</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">Your payment has been verified and your account has been upgraded to <strong>${planName}</strong>. All features are now active.</p>
      ${btn("Go to Dashboard", `${appUrl}/dashboard`)}
    `),
  }),

  payment_admin_alert: ({ userName, userEmail, amount, planName, adminUrl }) => ({
    subject: `New payment submitted — ${userEmail}`,
    html: layout(`
      <h2 style="margin-top:0;color:#111827;font-size:22px;">New payment to review</h2>
      <p style="color:#374151;line-height:1.7;">A user has submitted a manual payment and is awaiting approval.</p>
      <table width="100%" cellpadding="10" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;margin:20px 0;font-size:14px;">
        <tr><td style="color:#6b7280;width:140px;">Name</td><td style="color:#111827;font-weight:600;">${userName}</td></tr>
        <tr><td style="color:#6b7280;">Email</td><td style="color:#111827;">${userEmail}</td></tr>
        <tr><td style="color:#6b7280;">Plan</td><td style="color:#111827;font-weight:600;">${planName}</td></tr>
        <tr><td style="color:#6b7280;">Amount</td><td style="color:#111827;font-weight:600;">PKR ${amount}</td></tr>
      </table>
      ${btn("Review in Admin Panel", adminUrl)}
    `),
  }),

  host_invite: ({ fullName, companyName, inviteLink }) => ({
    subject: `You've been invited to join ${companyName} on EvaluTease`,
    html: layout(`
      <h2 style="margin-top:0;color:#111827;font-size:22px;">You're invited! 🎉</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${fullName}</strong>,</p>
      <p style="color:#374151;line-height:1.7;"><strong>${companyName}</strong> has invited you to join as a <strong>Host</strong> on EvaluTease — a platform for creating and managing quizzes and assessments.</p>
      ${btn("Accept Invitation", inviteLink)}
    `),
  }),
};

// ─── Handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, data } = body as { type: string; data: Record<string, string> };

    if (!type || !templates[type]) {
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM") ?? smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "Missing SMTP secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = templates[type](data);
    const to = data.to ?? data.email ?? data.invited_email;

    if (!to) {
      return new Response(JSON.stringify({ error: "No recipient email in data.to" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `EvaluTease <${fromEmail}>`,
      to,
      subject,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
