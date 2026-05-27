// @ts-nocheck — Deno runtime
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand colours (match app CSS: --primary oklch(0.82 0.16 180) ≈ teal)
const C = {
  primary:  "#2dd4bf",  // teal-400
  dark:     "#0f766e",  // teal-700 — CTA buttons, links
  bg:       "#f0fdfa",  // teal-50  — email background
  headerBg: "#134e4a",  // teal-900 — header
  border:   "#99f6e4",  // teal-200
};

const APP_URL = Deno.env.get("VITE_APP_URL") ?? "https://evalutease-suite.vercel.app";
const LOGO_URL = `${APP_URL}/jancho_transparent_4k.png`;

// ─── Shared branded wrapper ──────────────────────────────────
function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:${C.headerBg};padding:24px 36px;border-radius:14px 14px 0 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <img src="${LOGO_URL}" alt="Jancho" width="52" height="52"
                     style="display:block;border-radius:10px;"/>
              </td>
              <td style="vertical-align:middle;">
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Jancho</h1>
                <p style="margin:3px 0 0;color:${C.primary};font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Premium Live Quiz Platform</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:36px;border:1px solid ${C.border};border-top:none;border-radius:0 0 14px 14px;">
          ${content}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;"/>
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            You're receiving this email because you have an account on Jancho.<br/>
            If you didn't expect this, you can safely ignore it.
          </p>
          <!-- Signature -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:2px solid ${C.primary};padding-top:20px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">Warm &amp; Best Regards,</p>
                <p style="margin:0 0 12px;color:${C.dark};font-size:18px;font-weight:700;letter-spacing:-0.5px;">BabulTech</p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:3px 0;color:#6b7280;font-size:12px;">
                      📞 <a href="tel:+923102700403" style="color:#6b7280;text-decoration:none;">+92 310 2700403</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;color:#6b7280;font-size:12px;">
                      ✉️ <a href="mailto:contact@babultech.com" style="color:${C.dark};text-decoration:none;">contact@babultech.com</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;color:#6b7280;font-size:12px;">
                      📍 IDC Office: R48Q+JR4, Taj Colony Sector 48 B Korangi, Karachi, Pakistan<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;Head Office: Skardu, Gilgit-Baltistan, Pakistan
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
          <p style="margin:0;color:#9ca3af;font-size:11px;">© 2026 BabulTech · All rights reserved</p>
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
    <a href="${href}" style="background:${C.dark};color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;letter-spacing:0.2px;">${text}</a>
  </div>
  <p style="color:#6b7280;font-size:12px;text-align:center;">Button not working? <a href="${href}" style="color:${C.dark};word-break:break-all;">${href}</a></p>`;
}

// ─── Email templates ─────────────────────────────────────────
const templates: Record<string, (d: Record<string, string>) => { subject: string; html: string }> = {

  welcome: ({ name, appUrl }) => ({
    subject: "Welcome to Jancho 🎉",
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
    subject: `You've been invited to join ${companyName} on Jancho`,
    html: layout(`
      <h2 style="margin-top:0;color:#111827;font-size:22px;">You're invited! 🎉</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${fullName}</strong>,</p>
      <p style="color:#374151;line-height:1.7;"><strong>${companyName}</strong> has invited you to join as a <strong>Host</strong> on Jancho — a premium platform for creating and managing live quizzes and assessments.</p>
      ${btn("Accept Invitation", inviteLink)}
    `),
  }),

  quiz_scheduled: ({ recipientName, quizTitle, scheduledAt, accessCode, joinUrl }) => ({
    subject: `📋 You're registered: ${quizTitle}`,
    html: layout(`
      <h2 style="margin-top:0;color:#111827;font-size:22px;">You're registered for a quiz 📋</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${recipientName}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">You've been added to <strong>${quizTitle}</strong>. Here are your details:</p>
      <table width="100%" cellpadding="10" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;margin:20px 0;font-size:14px;">
        <tr><td style="color:#6b7280;width:140px;">Quiz</td><td style="color:#111827;font-weight:600;">${quizTitle}</td></tr>
        <tr><td style="color:#6b7280;">Scheduled</td><td style="color:#111827;">${scheduledAt}</td></tr>
        <tr><td style="color:#6b7280;">Access Code</td><td style="color:${C.dark};font-weight:900;font-size:18px;letter-spacing:3px;">${accessCode}</td></tr>
      </table>
      <p style="color:#374151;line-height:1.7;">When it's time, use the access code above or click the button below to join.</p>
      ${btn("Join Quiz →", joinUrl)}
    `),
  }),

  quiz_reminder: ({ recipientName, quizTitle, scheduledAt, accessCode, joinUrl }) => ({
    subject: `⏰ Starting in 5 min: ${quizTitle}`,
    html: layout(`
      <h2 style="margin-top:0;color:#d97706;font-size:22px;">⏰ Quiz starting in 5 minutes!</h2>
      <p style="color:#374151;line-height:1.7;">Hi <strong>${recipientName}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">Get ready — <strong>${quizTitle}</strong> is about to begin at <strong>${scheduledAt}</strong>.</p>
      <table width="100%" cellpadding="10" style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;margin:20px 0;font-size:14px;">
        <tr><td style="color:#6b7280;width:140px;">Access Code</td><td style="color:${C.dark};font-weight:900;font-size:20px;letter-spacing:3px;">${accessCode}</td></tr>
      </table>
      ${btn("Join Now →", joinUrl)}
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
      from: `Jancho <${fromEmail}>`,
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
