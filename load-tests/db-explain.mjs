import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const supabaseUrl = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const plan = clean(process.env.EXPLAIN_PLAN || process.argv[2] || "live_leaderboard");
const sessionId = clean(process.env.EXPLAIN_SESSION_ID || process.argv[3] || "");
const ownerId = clean(process.env.EXPLAIN_OWNER_ID || process.argv[4] || "");
const accessCode = clean(process.env.EXPLAIN_ACCESS_CODE || process.env.QUIZ_CODE || process.argv[5] || "");

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Add them to .env or your shell.");
}

const res = await fetch(`${supabaseUrl}/rest/v1/rpc/explain_quiz_hot_path`, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify({
    p_plan: plan,
    p_session_id: sessionId || null,
    p_owner_id: ownerId || null,
    p_access_code: accessCode || null,
  }),
});

const text = await res.text();
if (!res.ok) fail(`EXPLAIN failed: ${res.status} ${text}`);

const rows = text ? JSON.parse(text) : [];
console.log(`EXPLAIN ANALYZE: ${plan}`);
console.log(rows.map((row) => row.plan).join("\n"));

function loadDotEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = clean(line.slice(index + 1));
    if (!process.env[key]) process.env[key] = value;
  }
}

function clean(value = "") {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

