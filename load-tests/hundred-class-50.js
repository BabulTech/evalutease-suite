/**
 * k6 load test: 100 classes × 50 students = 5,000 concurrent participants
 *
 * Sessions: CL-001 … CL-100  (one dedicated session per class)
 *
 * Usage:
 *   k6 run load-tests/hundred-class-50.js \
 *     -e SUPABASE_URL=https://xxx.supabase.co \
 *     -e SUPABASE_ANON_KEY=eyJ...
 *
 * Smoke (10 VUs, 90 s):
 *   k6 run load-tests/hundred-class-50.js -e SMOKE=true ...
 */
import { check, group } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";
import { sleep } from "k6";

// ─── env ────────────────────────────────────────────────────────────────────
const SUPABASE_URL     = __ENV.SUPABASE_URL     || "";
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const SMOKE            = (__ENV.SMOKE || "false").toLowerCase() === "true";
const SUSTAIN          = __ENV.SUSTAIN || "5m";

const TOTAL_CLASSES  = 100;
const STUDENTS_CLASS = 50;
const TOTAL_VUS      = TOTAL_CLASSES * STUDENTS_CLASS; // 5 000

// 100 dedicated session codes — one per class
const SESSION_CODES = Array.from({ length: TOTAL_CLASSES }, (_, i) =>
  `CL-${String(i + 1).padStart(3, "0")}`
);

// ─── custom metrics ─────────────────────────────────────────────────────────
const sessionLoadOk   = new Rate("session_load_ok");
const joinOk          = new Rate("join_ok");
const answerOk        = new Rate("answer_ok");
const completeOk      = new Rate("complete_ok");
const joinLatency     = new Trend("join_latency_ms",     true);
const questionLatency = new Trend("question_latency_ms", true);

// ─── stages ─────────────────────────────────────────────────────────────────
// Smoke: tiny
const smokeStages = [
  { duration: "30s", target: 10 },
  { duration: "30s", target: 10 },
  { duration: "30s", target: 0  },
];

// Full: ramp 10 classes (500 VUs) every 30 s → reach 5 000 in 5 min, sustain, wind down
const fullStages = [
  { duration: "30s", target: 500  },   // classes  1-10
  { duration: "30s", target: 1000 },   // classes 11-20
  { duration: "30s", target: 1500 },   // classes 21-30
  { duration: "30s", target: 2000 },   // classes 31-40
  { duration: "30s", target: 2500 },   // classes 41-50
  { duration: "30s", target: 3000 },   // classes 51-60
  { duration: "30s", target: 3500 },   // classes 61-70
  { duration: "30s", target: 4000 },   // classes 71-80
  { duration: "30s", target: 4500 },   // classes 81-90
  { duration: "30s", target: TOTAL_VUS }, // classes 91-100 — full load
  { duration: SUSTAIN, target: TOTAL_VUS }, // sustain
  { duration: "60s",  target: 0 },         // wind down
];

export const options = {
  scenarios: {
    students: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: SMOKE ? smokeStages : fullStages,
      gracefulRampDown: "30s",
      gracefulStop: "30s",
      exec: "studentScenario",
      tags: { scenario: SMOKE ? "smoke" : "hundred_class_50" },
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.02"],
    http_req_duration: ["p(99)<4000"],
    session_load_ok:   ["rate>0.95"],
    join_ok:           ["rate>0.95"],
    answer_ok:         ["rate>0.90"],
    complete_ok:       ["rate>0.90"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ─── helpers ─────────────────────────────────────────────────────────────────
const BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  "apikey":        SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type":  "application/json",
  "Accept":        "application/json",
};

function rpc(fn, params, tags = {}) {
  return http.post(
    `${BASE}/rpc/${fn}`,
    JSON.stringify(params),
    { headers: HEADERS, tags }
  );
}

function pause(min = 1, max = null) {
  sleep(max ? min + Math.random() * (max - min) : min);
}

function safeJson(res) {
  try { return JSON.parse(res.body) || {}; } catch { return {}; }
}

// Each VU picks its own dedicated class session based on VU index
function mySessionCode() {
  const idx = (__VU - 1) % SESSION_CODES.length;
  return SESSION_CODES[idx];
}

// ─── setup ───────────────────────────────────────────────────────────────────
export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }

  // Verify first session is reachable
  const probe = rpc("get_session_for_join", { p_access_code: "CL-001" });
  if (probe.status !== 200) {
    throw new Error(`Session probe failed: HTTP ${probe.status} — ${probe.body}`);
  }
  console.log("Setup OK — CL-001 reachable, starting 5 000-VU test");
}

// ─── student scenario ────────────────────────────────────────────────────────
export function studentScenario() {
  const code = mySessionCode();
  const tags = { class: code };

  // 1. Load session (lobby check)
  const lobbyRes = rpc("get_session_for_join", { p_access_code: code }, tags);
  const lobbyData = safeJson(lobbyRes);
  const lobbyOk = lobbyRes.status === 200 &&
    !lobbyData.error &&
    lobbyData?.session?.access_code === code;

  sessionLoadOk.add(lobbyOk, tags);
  check(lobbyRes, { "lobby 200": () => lobbyOk });
  if (!lobbyOk) return;

  pause(0.5, 1.5);

  // 2. Join quiz — creates attempt
  const joinStart = Date.now();
  const joinRes = rpc("join_quiz_session", {
    p_access_code:  code,
    p_name: `VU-${__VU}-${__ITER}`,
  }, tags);
  joinLatency.add(Date.now() - joinStart, tags);

  const joinData  = safeJson(joinRes);
  const attemptId = joinData?.attempt_id ?? joinData?.[0]?.attempt_id ?? null;
  const didJoin   = joinRes.status === 200 && !!attemptId;

  joinOk.add(didJoin, tags);
  check(joinRes, { "join 200": () => didJoin });
  if (!didJoin) return;

  // 3. Fetch questions
  const qStart = Date.now();
  const playRes = rpc("get_session_for_play", {
    p_access_code: code,
    p_attempt_id:  attemptId,
  }, tags);
  questionLatency.add(Date.now() - qStart, tags);

  const playData  = safeJson(playRes);
  const questions = Array.isArray(playData?.questions) ? playData.questions : [];

  check(playRes, { "questions received": () => playRes.status === 200 && questions.length > 0 });
  if (questions.length === 0) return;

  // 4. Answer questions (batch of up to 10)
  const batch = [];
  const limit = Math.min(10, questions.length);
  for (let i = 0; i < limit; i++) {
    pause(1, 3); // think time per question
    const q = questions[i];
    batch.push({
      attempt_id:          attemptId,
      question_id:         q.id,
      answer:              q.options?.[0] ?? "A",
      time_taken_seconds:  Math.floor(1 + Math.random() * 20),
    });
  }

  const ansRes = rpc("submit_quiz_answers_batch", { p_answers: batch }, tags);
  const ansOk  = ansRes.status === 200 || ansRes.status === 204;
  answerOk.add(ansOk, tags);
  check(ansRes, { "answers submitted": () => ansOk });

  pause(0.5, 1);

  // 5. Complete attempt
  const complRes = rpc("complete_quiz_attempt", { p_attempt_id: attemptId }, tags);
  const cOk = complRes.status === 200 || complRes.status === 204;
  completeOk.add(cOk, tags);
  check(complRes, { "attempt completed": () => cOk });

  pause(1, 2);
}
