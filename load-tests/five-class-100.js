/**
 * k6 load test: 5 classes × 100 students = 500 concurrent participants
 *
 * Usage:
 *   k6 run load-tests/five-class-100.js \
 *     -e SUPABASE_URL=https://xxx.supabase.co \
 *     -e SUPABASE_ANON_KEY=eyJ... \
 *     -e QUIZ_CODES=CODE1,CODE2,CODE3,CODE4,CODE5
 *
 * Smoke mode (5 VUs, ~70 s):
 *   k6 run load-tests/five-class-100.js -e SMOKE=true -e QUIZ_CODES=<one-real-code> ...
 *
 * Optional teacher monitoring:
 *   -e ENABLE_TEACHERS=true \
 *   -e TEACHER_EMAIL=teacher@example.com \
 *   -e TEACHER_PASSWORD=password \
 *   -e TEACHER_SESSION_IDS=id1,id2,id3,id4,id5
 */
import { check, group } from "k6";
import { config, parseList } from "./config.js";
import {
  chooseQuizCode,
  chooseTeacherSessionId,
  completeAttempt,
  joinQuiz,
  loginTeacher,
  parseQuestions,
  pause,
  randomThinkTime,
  requireBaseConfig,
  restGet,
  rpc,
  safeJson,
  submitAnswerBatch,
  successfulSessionLoads,
  timedPage,
} from "./helpers.js";

const CLASSES            = Number(__ENV.CLASSES             || 5);
const STUDENTS_PER_CLASS = Number(__ENV.STUDENTS_PER_CLASS  || 100);
const TOTAL_STUDENTS     = CLASSES * STUDENTS_PER_CLASS;
const SUSTAIN_DURATION   = __ENV.SUSTAIN || "8m";

// SMOKE=true → 5 VUs, ~70 s run for connectivity verification
const isSmoke = (__ENV.SMOKE || "false").toLowerCase() === "true";

const studentStages = isSmoke
  ? [
      { duration: "20s", target: 5 },
      { duration: "40s", target: 5 },
      { duration: "10s", target: 0 },
    ]
  : [
      { duration: "30s", target: STUDENTS_PER_CLASS },         // class 1 joins
      { duration: "30s", target: STUDENTS_PER_CLASS * 2 },     // class 2
      { duration: "30s", target: STUDENTS_PER_CLASS * 3 },     // class 3
      { duration: "30s", target: STUDENTS_PER_CLASS * 4 },     // class 4
      { duration: "30s", target: TOTAL_STUDENTS },             // class 5 — full load
      { duration: SUSTAIN_DURATION, target: TOTAL_STUDENTS },  // sustain
      { duration: "60s", target: 0 },                          // wind down
    ];

export const options = {
  scenarios: {
    students: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: studentStages,
      gracefulRampDown: "30s",
      gracefulStop: "30s",
      exec: "studentScenario",
      tags: { scenario: isSmoke ? "smoke" : "five_class_100" },
    },
    ...((!isSmoke && (__ENV.ENABLE_TEACHERS || "false").toLowerCase() === "true")
      ? {
          teachers: {
            executor: "constant-vus",
            vus: CLASSES,
            duration: "11m",
            gracefulStop: "30s",
            exec: "teacherScenario",
            tags: { scenario: "five_class_100_teacher" },
          },
        }
      : {}),
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{weight:normal}": ["p(95)<1500"],
    "http_req_duration{weight:heavy}": ["p(95)<3000"],
    http_req_duration: ["p(99)<3000"],
    quiz_join_success_rate: ["rate>0.95"],
    session_load_success_rate: ["rate>0.95"],
    answer_submit_success_rate: ["rate>0.90"],
    complete_quiz_success_rate: ["rate>0.90"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  requireBaseConfig();
}

export function studentScenario() {
  const quizCode = chooseQuizCode();

  // Skip Vercel HTML page load — irrelevant to backend capacity,
  // and single-IP load tests get WAF-blocked by Vercel/CDN.
  // To test the frontend, use Grafana Cloud k6 (distributed IPs).

  // Verify session is accessible and get session info
  const joinSummary = rpc(
    "get_session_for_join",
    { p_access_code: quizCode },
    null,
    { flow: "participant", endpoint: "get_session_for_join", weight: "normal", quiz_code: quizCode },
  );
  const joinSummaryPayload = safeJson(joinSummary);
  const sessionLoadOk =
    joinSummary.status === 200 &&
    !joinSummaryPayload.error &&
    joinSummaryPayload?.session?.access_code === quizCode;
  successfulSessionLoads.add(sessionLoadOk, { quiz_code: quizCode });
  check(joinSummary, { "lobby load 200": () => sessionLoadOk });
  if (!sessionLoadOk) return;

  pause(1);

  // Join — creates an attempt for this VU
  const attemptId = joinQuiz(quizCode);
  if (!attemptId) return;

  // Fetch questions for this session
  const playRes = rpc(
    "get_session_for_play",
    { p_access_code: quizCode, p_attempt_id: attemptId },
    null,
    { flow: "participant", endpoint: "get_session_for_play", weight: "heavy", quiz_code: quizCode },
  );
  const playPayload = safeJson(playRes);
  check(playRes, {
    "questions received": (r) =>
      r.status === 200 &&
      Array.isArray(playPayload.questions) &&
      playPayload.questions.length > 0,
  });

  const questions = parseQuestions(playPayload);
  if (questions.length === 0) return;

  // Answer questions in batches with think time between each
  let batch = [];
  for (let i = 0; i < Math.min(config.questionCount, questions.length); i++) {
    pause(randomThinkTime());
    batch.push({
      attempt_id: attemptId,
      question_id: questions[i].id,
      answer: questions[i].answer,
      time_taken_seconds: Math.round(randomThinkTime()),
      quiz_code: quizCode,
    });
    if (batch.length >= config.answerBatchSize) {
      submitAnswerBatch(batch);
      batch = [];
    }
  }
  if (batch.length > 0) {
    submitAnswerBatch(batch);
  }

  // Mark attempt complete
  completeAttempt(attemptId);
  pause(2);
}

export function teacherScenario() {
  const token = loginTeacher();
  if (!token) return;

  const sessionId = chooseTeacherSessionId();
  if (!sessionId) return;

  timedPage(`/sessions/${sessionId}`, "teacher_session_page");

  // Poll teacher dashboard every ~5 s for the scenario duration
  const pollEnd = Date.now() + config.teacherMonitorSeconds * 1000;
  while (Date.now() < pollEnd) {
    group("teacher dashboard poll", () => {
      restGet(
        `quiz_attempts?session_id=eq.${sessionId}&select=id,completed,score&limit=25&order=score.desc`,
        token,
        { flow: "teacher", endpoint: "teacher_poll_attempts", weight: "normal" },
      );
    });
    pause(4, 6);
  }
}
