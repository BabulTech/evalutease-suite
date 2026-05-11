import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const supabaseUrl = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const quizCode = clean(process.env.LOAD_TEST_QUIZ_CODE || process.env.QUIZ_CODE) || "LOAD20";
const explicitQuizCodes = parseList(process.env.LOAD_TEST_QUIZ_CODES || process.env.QUIZ_CODES);
const sessionCount = Number(process.env.LOAD_TEST_SESSION_COUNT || explicitQuizCodes.length || 1);
const codePrefix = clean(process.env.LOAD_TEST_CODE_PREFIX) || quizCode;
const questionCount = Number(process.env.QUESTION_COUNT || 20);
const title = process.env.LOAD_TEST_QUIZ_TITLE || `Load Test ${questionCount}-Question Quiz`;

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

const ownerId = clean(process.env.LOAD_TEST_OWNER_ID) || (await discoverOwnerId());

if (!ownerId) {
  fail("Missing owner id. Set LOAD_TEST_OWNER_ID, or keep at least one existing quiz_session so the script can discover an owner_id.");
}

const existingQuestions = await getJson(
  `/rest/v1/questions?select=id,text&owner_id=eq.${ownerId}&topic=eq.k6-load-test&order=created_at.asc&limit=${questionCount}`,
);

let questions = existingQuestions;
if (questions.length < questionCount) {
  const missing = questionCount - questions.length;
  const start = questions.length + 1;
  const rows = Array.from({ length: missing }, (_, index) => {
    const n = start + index;
    return {
      owner_id: ownerId,
      subject: "Load Testing",
      topic: "k6-load-test",
      text: `Load test question ${n}: choose option A.`,
      type: "mcq",
      difficulty: "easy",
      options: ["A", "B", "C", "D"],
      correct_answer: "A",
      explanation: "Synthetic load-test question.",
      source: "manual",
      language: "en",
      time_seconds: 30,
    };
  });
  await postJson("/rest/v1/questions", rows);
  questions = await getJson(
    `/rest/v1/questions?select=id,text&owner_id=eq.${ownerId}&topic=eq.k6-load-test&order=created_at.asc&limit=${questionCount}`,
  );
}

const codes = explicitQuizCodes.length > 0
  ? explicitQuizCodes
  : Array.from({ length: sessionCount }, (_, index) => (sessionCount === 1 ? quizCode : `${codePrefix}-${index + 1}`));
const sessions = [];

for (const code of codes) {
  const session = await upsertSession(code);
  await deleteRequest(`/rest/v1/quiz_session_questions?session_id=eq.${session.id}`);
  const links = questions.slice(0, questionCount).map((question, index) => ({
    session_id: session.id,
    question_id: question.id,
    position: index,
    time_seconds: 30,
  }));
  await postJson("/rest/v1/quiz_session_questions", links);
  sessions.push(session);
}

console.log("Load-test quiz session(s) are ready.");
console.log(`QUIZ_CODES=${sessions.map((session) => session.access_code).join(",")}`);
console.log(`TEACHER_SESSION_IDS=${sessions.map((session) => session.id).join(",")}`);
console.log(`QUESTION_COUNT=${questionCount}`);
console.log(`SESSION_COUNT=${sessions.length}`);
console.log("Use these quiz codes for multi-class participant testing. With ANSWER_BATCH_SIZE=5, 20 questions should produce 4 batch answer RPCs per completed participant.");

async function upsertSession(code) {
  const existing = await getJson(
    `/rest/v1/quiz_sessions?select=id,access_code,title&access_code=eq.${encodeURIComponent(code)}&limit=1`,
  );
  const existingSession = existing[0];
  if (!existingSession) {
    const [created] = await postJson("/rest/v1/quiz_sessions", {
      owner_id: ownerId,
      title: `${title} ${code}`,
      subject: "Load Testing",
      topic: "Backend throughput",
      description: "Dedicated dummy quiz for k6 load testing.",
      language: "en",
      mode: "qr_link",
      status: "active",
      default_time_per_question: 30,
      access_code: code,
      is_open: true,
      started_at: new Date().toISOString(),
      paused_at: null,
      pause_offset_seconds: 0,
    });
    return created;
  }

  const [updated] = await patchJson(`/rest/v1/quiz_sessions?id=eq.${existingSession.id}`, {
    title: `${title} ${code}`,
    status: "active",
    is_open: true,
    started_at: new Date().toISOString(),
    paused_at: null,
    pause_offset_seconds: 0,
    default_time_per_question: 30,
  });
  return updated;
}

async function discoverOwnerId() {
  const rows = await getJson(
    "/rest/v1/quiz_sessions?select=owner_id,created_at&order=created_at.desc&limit=1",
    false,
  );
  return rows[0]?.owner_id || "";
}

async function getJson(restPath, requireConfig = true) {
  if (requireConfig) ensureConfig();
  const res = await fetch(`${supabaseUrl}${restPath}`, { headers });
  return readResponse(res, "GET", restPath);
}

async function postJson(restPath, body) {
  ensureConfig();
  const res = await fetch(`${supabaseUrl}${restPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return readResponse(res, "POST", restPath);
}

async function patchJson(restPath, body) {
  ensureConfig();
  const res = await fetch(`${supabaseUrl}${restPath}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return readResponse(res, "PATCH", restPath);
}

async function deleteRequest(restPath) {
  ensureConfig();
  const res = await fetch(`${supabaseUrl}${restPath}`, {
    method: "DELETE",
    headers: { ...headers, prefer: "return=minimal" },
  });
  if (!res.ok) {
    fail(`DELETE ${restPath} failed: ${res.status} ${await res.text()}`);
  }
}

async function readResponse(res, method, restPath) {
  const text = await res.text();
  if (!res.ok) {
    fail(`${method} ${restPath} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : [];
}

function ensureConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    fail("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
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
