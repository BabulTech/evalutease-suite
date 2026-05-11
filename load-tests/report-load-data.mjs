import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const supabaseUrl = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const quizCode = clean(process.env.LOAD_TEST_QUIZ_CODE || process.env.QUIZ_CODE) || "LOAD20";
const quizCodes = parseList(process.env.LOAD_TEST_QUIZ_CODES || process.env.QUIZ_CODES || quizCode);

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Add them to .env or your shell.");
}

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  accept: "application/json",
};

console.log("Load-test database report");
let totalAttempts = 0;
let totalCompleted = 0;
let totalAnswers = 0;

for (const code of quizCodes) {
  const sessions = await getJson(
    `/rest/v1/quiz_sessions?select=id,title,status,access_code,is_open&access_code=eq.${encodeURIComponent(code)}&limit=1`,
  );
  const session = sessions[0];
  if (!session) {
    console.log(`\nQuiz code ${code}: not found`);
    continue;
  }

  const questionCount = await countRows(`/rest/v1/quiz_session_questions?session_id=eq.${session.id}&select=id`);
  const attemptCount = await countRows(
    `/rest/v1/quiz_attempts?session_id=eq.${session.id}&participant_email=like.load-%25%40example.test&select=id`,
  );
  const completedCount = await countRows(
    `/rest/v1/quiz_attempts?session_id=eq.${session.id}&participant_email=like.load-%25%40example.test&completed=eq.true&select=id`,
  );
  const answers = await getJson(
    `/rest/v1/quiz_answers?select=id,quiz_attempts!inner(session_id,participant_email)&quiz_attempts.session_id=eq.${session.id}&quiz_attempts.participant_email=like.load-%25%40example.test&limit=50000`,
  );

  totalAttempts += attemptCount;
  totalCompleted += completedCount;
  totalAnswers += answers.length;

  console.log(`\nQuiz code: ${session.access_code}`);
  console.log(`Session ID: ${session.id}`);
  console.log(`Status/open: ${session.status}/${session.is_open}`);
  console.log(`Questions linked: ${questionCount}`);
  console.log(`Load-test attempts: ${attemptCount}`);
  console.log(`Completed attempts: ${completedCount}`);
  console.log(`Load-test answer rows: ${answers.length}`);
  console.log(`Average answers per completed attempt: ${completedCount > 0 ? (answers.length / completedCount).toFixed(2) : "0.00"}`);
}

console.log("\nTotals");
console.log(`Sessions requested: ${quizCodes.length}`);
console.log(`Load-test attempts: ${totalAttempts}`);
console.log(`Completed attempts: ${totalCompleted}`);
console.log(`Load-test answer rows: ${totalAnswers}`);
console.log(`Average answers per completed attempt: ${totalCompleted > 0 ? (totalAnswers / totalCompleted).toFixed(2) : "0.00"}`);
console.log("Expected batch RPCs per 20-question completed attempt at batch size 5: 4");

async function getJson(restPath) {
  const res = await fetch(`${supabaseUrl}${restPath}`, { headers });
  const text = await res.text();
  if (!res.ok) fail(`GET ${restPath} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : [];
}

async function countRows(restPath) {
  const res = await fetch(`${supabaseUrl}${restPath}`, {
    headers: { ...headers, prefer: "count=exact" },
  });
  if (!res.ok) fail(`COUNT ${restPath} failed: ${res.status} ${await res.text()}`);
  const range = res.headers.get("content-range") || "*/0";
  return Number(range.split("/")[1] || 0);
}

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

function parseList(value = "") {
  return String(value)
    .split(",")
    .map((item) => clean(item))
    .filter(Boolean);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
