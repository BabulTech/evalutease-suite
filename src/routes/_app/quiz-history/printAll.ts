import { getQuizReportRows, formatDuration } from "@/lib/quiz-reports";
import { QUIZ_TYPE_LABELS } from "./types";
import type { SessionWithStats, AttemptRow, ProfileRow } from "./types";
import { toReportAttempt, subjectLabel, getTeacherName } from "./helpers";

export function printAll(
  sessions: SessionWithStats[],
  expandedAttempts: Record<string, AttemptRow[]>,
  sessionMaxPts: Record<string, number>,
  profile: ProfileRow | null,
  userEmail?: string | null,
) {
  const teacherName = getTeacherName(profile, userEmail);
  const schoolName = profile?.organization ?? "";
  const now = new Date().toLocaleString();
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const sessionBlocks = sessions
    .map((s) => {
      const fullAttempts = expandedAttempts[s.id] ?? s.attempts;
      const reportRows = getQuizReportRows(
        fullAttempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id])),
      ).filter((a) => a.completed);
      const tableRows = reportRows
        .map(
          (r, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};">
        <td style="text-align:center;font-weight:700;">${r.rank}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${esc(r.rollNumber) || "-"}</td>
        <td>${esc(r.email) || "-"}</td>
        <td style="text-align:center;">${r.attemptedQuestions}</td>
        <td style="text-align:center;color:#16a34a;font-weight:700;">${r.score}</td>
        <td style="text-align:center;">${formatDuration(r.durationSeconds ?? null)}</td>
        <td style="text-align:center;">${r.unattemptedQuestions}</td>
      </tr>`,
        )
        .join("");

      return `
    <div class="session-block">
      <div class="top-bar">
        <div>
          <div class="app-name">EvaluTease</div>
          <div class="app-sub">Quiz Results Report</div>
        </div>
        <div class="print-date">
          <div>Printed: ${esc(now)}</div>
          <div>Total Participants: ${reportRows.length}</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="lbl">Company / School</div><div class="val">${esc(schoolName) || "Not specified"}</div></div>
        <div class="info-item"><div class="lbl">Host / Teacher</div><div class="val">${esc(teacherName)}</div></div>
        <div class="info-item full"><div class="lbl">Quiz Topic</div><div class="val">${esc(s.title)}${s.topic ? ", " + esc(QUIZ_TYPE_LABELS[s.topic] ?? s.topic) : ""}</div></div>
        <div class="info-item"><div class="lbl">Subject</div><div class="val">${esc(subjectLabel(s))}</div></div>
        <div class="info-item"><div class="lbl">Total Questions</div><div class="val">${fullAttempts[0]?.total_questions ?? 0}</div></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th class="center">Rank</th><th>Participant Name</th><th>Roll Number</th><th>Email</th>
            <th class="center">Attempted</th><th class="center">Points</th>
            <th class="center">Total Time</th><th class="center">Unattempted</th>
          </tr></thead>
          <tbody>${tableRows || '<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:12px;">No submissions</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>All Quiz Results</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }
    .session-block { margin-bottom: 40px; page-break-after: always; }
    .session-block:last-child { page-break-after: auto; }
    .top-bar { background: #6d28d9; color: #fff; padding: 14px 20px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .top-bar .app-name { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
    .top-bar .app-sub { font-size: 10px; opacity: 0.8; margin-top: 2px; }
    .top-bar .print-date { font-size: 10px; opacity: 0.8; text-align: right; }
    .info-grid { border: 1px solid #e5e7eb; border-top: none; padding: 14px 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; }
    .info-item { padding: 6px 10px 6px 0; border-bottom: 1px solid #f3f4f6; }
    .info-item .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; }
    .info-item .val { font-size: 12px; font-weight: 600; margin-top: 1px; color: #111; }
    .info-item.full { grid-column: 1 / -1; }
    .table-wrap { margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #6d28d9; color: #fff; }
    thead th { padding: 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    thead th.center { text-align: center; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    .signature { margin-top: 20px; border-top: 2px solid #6d28d9; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .sig-left .greeting { font-size: 11px; color: #374151; margin-bottom: 3px; }
    .sig-left .brand { font-size: 17px; font-weight: 700; color: #6d28d9; margin-bottom: 6px; }
    .sig-left .contact { font-size: 10px; color: #6b7280; line-height: 1.8; }
    .sig-right { font-size: 9px; color: #9ca3af; text-align: right; line-height: 1.7; }
    @media print { body { padding: 8px; } @page { margin: 10mm; size: A4 landscape; } }
  </style>
</head>
<body>
  ${sessionBlocks}
  <div class="signature">
    <div class="sig-left">
      <div class="greeting">Warm &amp; Best Regards,</div>
      <div class="brand">BabulQ</div>
      <div class="contact">
        📞 +92 310 2700403<br/>
        ✉️ contact@babultech.com<br/>
        📍 <a href="https://maps.app.goo.gl/68znfMTx4ar17ipD9" style="color:#6d28d9;text-decoration:none;">IDC Office, Islamabad, View on Maps</a>
      </div>
    </div>
    <div class="sig-right">
      <div>© 2025 BabulTech · All rights reserved</div>
      <div>evalutease.com</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
