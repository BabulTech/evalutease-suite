import { check, group } from "k6";
import { options as scenarioOptions } from "./scenarios.js";
import { config, selectedSchoolProfile } from "./config.js";
import {
  completeAttempt,
  chooseQuizCode,
  chooseTeacherSessionId,
  joinQuiz,
  loginTeacher,
  optionalRealtimeProbe,
  parseQuestions,
  pause,
  randomThinkTime,
  requireBaseConfig,
  restGet,
  restPatch,
  rpc,
  safeJson,
  successfulSessionLoads,
  successfulTeacherDashboard,
  submitAnswerBatch,
  timedPage,
} from "./helpers.js";
import { realtimeProbe } from "./realtime.js";

export const options = scenarioOptions;

export function setup() {
  requireBaseConfig();
  const scenario = (__ENV.K6_SCENARIO || "mixed").toLowerCase();
  if (scenario === "school") {
    const school = selectedSchoolProfile();
    if (config.quizCodes.length < school.classes) {
      throw new Error(
        `SCHOOL_PROFILE=${school.name} needs ${school.classes} quiz codes, but QUIZ_CODES has ${config.quizCodes.length}. Run npm run load:setup with LOAD_TEST_SESSION_COUNT=${school.classes}, then pass all generated codes.`,
      );
    }
  }
  return {
    appBaseUrl: config.appBaseUrl,
    quizCode: config.quizCode,
    quizCodes: config.quizCodes,
    questionCount: config.questionCount,
  };
}

export function publicVisitorScenario() {
  group("public pages", () => {
    timedPage("/", "home");
    pause(1);
    timedPage("/login", "login_page");
    pause(1);
    timedPage("/signup", "signup_page");
  });
}

export function teacherScenario() {
  group("teacher login and dashboard", () => {
    const token = loginTeacher();
    if (!token) {
      timedPage("/login", "teacher_login_page");
      pause(5);
      return;
    }

    timedPage("/dashboard", "dashboard_page");
    const dashboardRes = restGet(
      `quiz_sessions?select=id,title,status,access_code,created_at&order=created_at.desc&limit=${config.dashboardPageSize}`,
      token,
      { flow: "teacher", endpoint: "dashboard_sessions", weight: "heavy" },
    );
    successfulTeacherDashboard.add(dashboardRes.status === 200);
    restGet(
      "question_categories?select=id,name&order=name.asc&limit=50",
      token,
      { flow: "teacher", endpoint: "question_categories", weight: "normal" },
    );

    const sessionId = chooseTeacherSessionId();
    if (!sessionId) {
      return;
    }

    timedPage(`/sessions/${sessionId}`, "teacher_session_page");

    if (config.allowTeacherMutations) {
      const startedAt = new Date().toISOString();
      const startRes = restPatch(
        `quiz_sessions?id=eq.${sessionId}`,
        {
          status: "active",
          is_open: true,
          started_at: startedAt,
          paused_at: null,
          pause_offset_seconds: 0,
        },
        token,
        { flow: "teacher", endpoint: "start_session", weight: "heavy" },
      );
      check(startRes, { "start session status is 200/204": (r) => r.status === 200 || r.status === 204 });
    }

    pause(2);
    rpc("get_session_leaderboard", { p_session_id: sessionId }, token, {
      flow: "teacher",
      endpoint: "monitor_leaderboard",
      weight: "heavy",
      session_id: sessionId,
    });

    if (config.allowTeacherMutations && config.allowTeacherPauseResume) {
      rpc("pause_quiz_session", { p_session_id: sessionId }, token, {
        flow: "teacher",
        endpoint: "pause_session",
        weight: "heavy",
        session_id: sessionId,
      });
      pause(1);
      rpc("resume_quiz_session", { p_session_id: sessionId }, token, {
        flow: "teacher",
        endpoint: "resume_session",
        weight: "heavy",
        session_id: sessionId,
      });
    }

    pause(config.teacherMonitorSeconds);

    if (config.allowTeacherMutations && config.allowSessionClose) {
      const closeRes = rpc("close_quiz_session", { p_session_id: sessionId }, token, {
        flow: "teacher",
        endpoint: "close_session",
        weight: "heavy",
        session_id: sessionId,
      });
      check(closeRes, { "close session status is 200": (r) => r.status === 200 });
    }
  });
}

export function participantScenario() {
  group("participant full quiz", () => {
    const quizCode = chooseQuizCode();
    timedPage(`/q/${quizCode}`, "participant_quiz_page");
    optionalRealtimeProbe(quizCode);

    const joinSummary = rpc("get_session_for_join", { p_access_code: quizCode }, null, {
      flow: "participant",
      endpoint: "get_session_for_join",
      weight: "normal",
      quiz_code: quizCode,
    });
    const joinSummaryPayload = safeJson(joinSummary);
    const sessionLoadOk =
      joinSummary.status === 200 &&
      !joinSummaryPayload.error &&
      joinSummaryPayload?.session?.access_code === quizCode;
    successfulSessionLoads.add(sessionLoadOk, { quiz_code: quizCode });
    check(joinSummary, {
      "lobby load status is 200": () => sessionLoadOk,
    });

    pause(1);
    const attemptId = joinQuiz(quizCode);
    if (!attemptId) return;

    const playRes = rpc("get_session_for_play", {
      p_access_code: quizCode,
      p_attempt_id: attemptId,
    }, null, {
      flow: "participant",
      endpoint: "get_session_for_play",
      weight: "heavy",
      quiz_code: quizCode,
    });
    const playPayload = safeJson(playRes);
    const playSessionMatches = playPayload?.session?.access_code === quizCode;
    check(playRes, {
      "questions received": (r) => r.status === 200 && playSessionMatches && Array.isArray(playPayload.questions) && playPayload.questions.length > 0,
    });

    const questions = parseQuestions(playPayload);
    if (questions.length === 0) return;

    let batch = [];
    for (let i = 0; i < Math.min(config.questionCount, questions.length); i += 1) {
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

    completeAttempt(attemptId);
    timedPage(`/q/${quizCode}`, "participant_result_page");
  });
}

export function realtimeScenario() {
  group("realtime session channel", () => {
    realtimeProbe(chooseQuizCode(), config.realtimeHoldSeconds);
  });
}

export default function mixedScenario() {
  participantScenario();
}
