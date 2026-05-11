import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const supabaseUrl = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const quizCode = clean(process.env.LOAD_TEST_QUIZ_CODE || process.env.QUIZ_CODE) || "LOAD20";
const quizCodes = parseList(process.env.LOAD_TEST_QUIZ_CODES || process.env.QUIZ_CODES || quizCode);
const deleteQuiz = clean(process.env.DELETE_LOAD_TEST_QUIZ).toLowerCase() === "true";
const deleteQuestions = clean(process.env.DELETE_LOAD_TEST_QUESTIONS).toLowerCase() === "true";

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Add them to .env or your shell.");
}

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  accept: "application/json",
  prefer: "return=representation",
};

let deletedAttempts = 0;
let deletedSessions = 0;

for (const code of quizCodes) {
  const sessions = await getJson(
    `/rest/v1/quiz_sessions?select=id,title,access_code&access_code=eq.${encodeURIComponent(code)}&limit=1`,
  );
  const session = sessions[0];
  if (!session) continue;

  const attempts = await getJson(
    `/rest/v1/quiz_attempts?select=id&session_id=eq.${session.id}&participant_email=like.load-%25%40example.test&limit=50000`,
  );
  deletedAttempts += attempts.length;
  if (attempts.length > 0) {
    await deleteRequest(
      `/rest/v1/quiz_attempts?session_id=eq.${session.id}&participant_email=like.load-%25%40example.test`,
    );
  }

  if (deleteQuiz) {
    await deleteRequest(`/rest/v1/quiz_sessions?id=eq.${session.id}`);
    deletedSessions += 1;
  }
}

if (deleteQuestions) {
  await deleteRequest(
    "/rest/v1/questions?topic=eq.k6-load-test",
  );
}

console.log("Load-test cleanup finished.");
console.log(`Session codes: ${quizCodes.join(",")}`);
console.log(`Deleted attempts: ${deletedAttempts}`);
console.log(`Deleted quiz sessions: ${deletedSessions}`);
console.log(`Deleted generated questions: ${deleteQuestions}`);

async function getJson(restPath) {
  const res = await fetch(`${supabaseUrl}${restPath}`, { headers });
  const text = await res.text();
  if (!res.ok) fail(`GET ${restPath} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : [];
}

async function deleteRequest(restPath) {
  const res = await fetch(`${supabaseUrl}${restPath}`, {
    method: "DELETE",
    headers: { ...headers, prefer: "return=minimal" },
  });
  if (!res.ok) fail(`DELETE ${restPath} failed: ${res.status} ${await res.text()}`);
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
