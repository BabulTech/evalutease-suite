/**
 * k6 load test: 50 classes × 50 students = 2,500 concurrent participants
 *
 * Uses the same helpers as the existing load tests so the join flow
 * is identical to what the app does.
 *
 * Sessions: CL-001 … CL-050 (one per class)
 *
 * Usage:
 *   k6 run load-tests/fifty-class-50.js \
 *     -e SUPABASE_URL=https://xxx.supabase.co \
 *     -e SUPABASE_ANON_KEY=eyJ...
 *
 * Smoke (10 VUs, 90 s):
 *   k6 run load-tests/fifty-class-50.js -e SMOKE=true ...
 */
import { check } from "k6";
import {
  joinQuiz,
  completeAttempt,
  requireBaseConfig,
  rpc,
  safeJson,
  pause,
  successfulSessionLoads,
} from "./helpers.js";

// ─── config ──────────────────────────────────────────────────────────────────
const SMOKE   = (__ENV.SMOKE || "false").toLowerCase() === "true";
const SUSTAIN = __ENV.SUSTAIN || "5m";

const TOTAL_CLASSES  = 50;
const STUDENTS_CLASS = 50;
const TOTAL_VUS      = TOTAL_CLASSES * STUDENTS_CLASS; // 2 500

const SESSION_CODES = Array.from({ length: TOTAL_CLASSES }, (_, i) =>
  `CL-${String(i + 1).padStart(3, "0")}`
);

function myCode() {
  return SESSION_CODES[(__VU - 1) % SESSION_CODES.length];
}

// ─── stages ──────────────────────────────────────────────────────────────────
const fullStages = [
  { duration: "30s", target: 250  },
  { duration: "30s", target: 500  },
  { duration: "30s", target: 750  },
  { duration: "30s", target: 1000 },
  { duration: "30s", target: 1250 },
  { duration: "30s", target: 1500 },
  { duration: "30s", target: 1750 },
  { duration: "30s", target: 2000 },
  { duration: "30s", target: 2250 },
  { duration: "30s", target: TOTAL_VUS },
  { duration: SUSTAIN, target: TOTAL_VUS },
  { duration: "30s",   target: 0 },
];

const smokeStages = [
  { duration: "20s", target: 10 },
  { duration: "40s", target: 10 },
  { duration: "10s", target: 0  },
];

export const options = {
  scenarios: {
    students: {
      executor:         "ramping-vus",
      startVUs:         0,
      stages:           SMOKE ? smokeStages : fullStages,
      gracefulRampDown: "30s",
      gracefulStop:     "30s",
      exec:             "studentScenario",
      tags:             { scenario: SMOKE ? "smoke" : "fifty_class_50" },
    },
  },
  thresholds: {
    http_req_failed:          ["rate<0.02"],
    http_req_duration:        ["p(99)<4000"],
    session_load_success_rate:["rate>0.95"],
    quiz_join_success_rate:   ["rate>0.95"],
    complete_quiz_success_rate:["rate>0.90"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ─── setup ───────────────────────────────────────────────────────────────────
export function setup() {
  requireBaseConfig();

  const probe = rpc("get_session_for_join", { p_access_code: "CL-001" });
  const data  = safeJson(probe);
  if (probe.status !== 200 || data.error) {
    throw new Error(`Setup failed: HTTP ${probe.status} — ${probe.body}`);
  }
  console.log(`Setup OK — CL-001 active. Starting ${TOTAL_VUS}-VU test.`);
}

// ─── student flow ─────────────────────────────────────────────────────────────
export function studentScenario() {
  const code = myCode();

  // 1. Lobby check
  const lobbyRes  = rpc(
    "get_session_for_join",
    { p_access_code: code },
    null,
    { flow: "participant", endpoint: "get_session_for_join", weight: "normal" },
  );
  const lobbyData = safeJson(lobbyRes);
  const lobbyOk   = lobbyRes.status === 200 &&
                    !lobbyData.error &&
                    lobbyData?.session?.access_code === code;

  successfulSessionLoads.add(lobbyOk, { quiz_code: code });
  check(lobbyRes, { "lobby 200": () => lobbyOk });
  if (!lobbyOk) return;

  pause(1);

  // 2. Join — uses the same helper the app uses
  const attemptId = joinQuiz(code);
  if (!attemptId) return;

  pause(1 + Math.random() * 2);

  // 3. Complete
  completeAttempt(attemptId);
  pause(1);
}
