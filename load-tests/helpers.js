import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { config } from "./config.js";
import { realtimeProbe } from "./realtime.js";

export const appPageBytes = new Counter("app_page_bytes");
export const supabaseBytes = new Counter("supabase_api_bytes");
export const quizFlowBytes = new Counter("participant_quiz_flow_bytes");
export const successfulLogins = new Rate("login_success_rate");
export const successfulJoins = new Rate("quiz_join_success_rate");
export const successfulAnswers = new Rate("answer_submit_success_rate");
export const successfulCompletions = new Rate("complete_quiz_success_rate");
export const successfulSessionLoads = new Rate("session_load_success_rate");
export const successfulTeacherDashboard = new Rate("teacher_dashboard_success_rate");
export const normalLatency = new Trend("normal_request_duration", true);
export const heavyLatency = new Trend("heavy_request_duration", true);

export function requireBaseConfig() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY. Pass them with -e or set them in your shell.",
    );
  }
}

export function jsonHeaders(token) {
  return {
    apikey: config.supabaseAnonKey,
    authorization: `Bearer ${token || config.supabaseAnonKey}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

export function timedPage(path, name) {
  const res = http.get(`${config.appBaseUrl}${path}`, {
    tags: { flow: "public", endpoint: name || path, weight: "normal" },
  });
  appPageBytes.add((res.body || "").length);
  normalLatency.add(res.timings.duration, { endpoint: name || path });
  check(res, {
    [`${name || path} status is 200`]: (r) => r.status === 200,
  });
  return res;
}

export function chooseQuizCode() {
  const codes = config.quizCodes.length > 0 ? config.quizCodes : [config.quizCode];
  if (codes.length === 1) return codes[0];
  if (config.quizSelection === "random") return codes[Math.floor(Math.random() * codes.length)];
  return codes[(__VU - 1) % codes.length];
}

export function chooseTeacherSessionId() {
  const ids = config.teacherSessionIds.length > 0 ? config.teacherSessionIds : [config.teacherSessionId].filter(Boolean);
  if (ids.length === 0) return "";
  return ids[(__VU - 1) % ids.length];
}

export function rpc(name, body, token, tags = {}) {
  const res = http.post(`${config.supabaseUrl}/rest/v1/rpc/${name}`, JSON.stringify(body || {}), {
    headers: jsonHeaders(token),
    tags: { flow: "supabase_rpc", endpoint: name, weight: "normal", ...tags },
  });
  supabaseBytes.add((res.body || "").length);
  normalLatency.add(res.timings.duration, { endpoint: name });
  return res;
}

export function restGet(path, token, tags = {}) {
  const res = http.get(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: jsonHeaders(token),
    tags: { flow: "supabase_rest", weight: "normal", ...tags },
  });
  supabaseBytes.add((res.body || "").length);
  normalLatency.add(res.timings.duration, { endpoint: tags.endpoint || path });
  return res;
}

export function restPatch(path, body, token, tags = {}) {
  const res = http.patch(`${config.supabaseUrl}/rest/v1/${path}`, JSON.stringify(body || {}), {
    headers: jsonHeaders(token),
    tags: { flow: "supabase_rest", weight: "heavy", ...tags },
  });
  supabaseBytes.add((res.body || "").length);
  heavyLatency.add(res.timings.duration, { endpoint: tags.endpoint || path });
  return res;
}

export function loginTeacher() {
  if (!config.teacherEmail || !config.teacherPassword) {
    return null;
  }

  const res = http.post(
    `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: config.teacherEmail,
      password: config.teacherPassword,
    }),
    {
      headers: jsonHeaders(),
      tags: { flow: "teacher", endpoint: "supabase_auth_login", weight: "heavy" },
    },
  );

  supabaseBytes.add((res.body || "").length);
  heavyLatency.add(res.timings.duration, { endpoint: "supabase_auth_login" });
  const ok = check(res, {
    "login success": (r) => r.status === 200 && !!safeJson(r).access_token,
  });
  successfulLogins.add(ok);
  return ok ? safeJson(res).access_token : null;
}

export function joinQuiz(quizCode = config.quizCode) {
  const unique = `${__VU}-${__ITER}-${Date.now()}`;
  const res = rpc("join_quiz_session", {
    p_access_code: quizCode,
    p_name: `Load User ${unique}`,
    p_email: `load-${unique}@example.test`,
    p_mobile: null,
    p_roll_number: unique,
  }, null, { flow: "participant", endpoint: "join_quiz_session", weight: "heavy", quiz_code: quizCode });

  quizFlowBytes.add((res.body || "").length);
  const payload = safeJson(res);
  const ok = check(res, {
    "quiz join success": (r) => r.status === 200 && !!payload.attempt_id && !payload.error,
  });
  successfulJoins.add(ok);
  return ok ? payload.attempt_id : null;
}

export function submitAnswerBatch(batch) {
  const quizCode = batch[0]?.quiz_code;
  const answers = batch.map(({ quiz_code, ...answer }) => answer);
  const res = rpc("submit_quiz_answers_batch", { p_answers: answers }, null, {
    flow: "participant",
    endpoint: "submit_quiz_answers_batch",
    weight: "normal",
    ...(quizCode ? { quiz_code: quizCode } : {}),
  });
  quizFlowBytes.add((res.body || "").length);
  const payload = safeJson(res);
  const ok = check(res, {
    "answer submit success": (r) => r.status === 200 && payload.ok === true,
  });
  successfulAnswers.add(ok);
  return ok;
}

export function completeAttempt(attemptId) {
  const res = rpc("complete_quiz_attempt", { p_attempt_id: attemptId }, null, {
    flow: "participant",
    endpoint: "complete_quiz_attempt",
    weight: "heavy",
  });
  quizFlowBytes.add((res.body || "").length);
  const payload = safeJson(res);
  const ok = check(res, {
    "complete quiz success": (r) => r.status === 200 && payload && !payload.error,
  });
  successfulCompletions.add(ok);
  return ok;
}

export function optionalRealtimeProbe(quizCode = chooseQuizCode()) {
  if (!config.enableRealtime) return;
  realtimeProbe(quizCode, config.realtimeHoldSeconds);
}

export function parseQuestions(playPayload) {
  const questions = playPayload && Array.isArray(playPayload.questions) ? playPayload.questions : [];
  return questions
    .slice(0, config.questionCount)
    .map((q, index) => ({
      id: q.id || q.question_id,
      answer: Array.isArray(q.options) && q.options.length > 0 ? String(q.options[index % q.options.length]) : "A",
    }))
    .filter((q) => q.id);
}

export function safeJson(res) {
  try {
    return res.json();
  } catch (_) {
    return {};
  }
}

export function randomThinkTime() {
  const min = Math.max(0, config.thinkMinSeconds);
  const max = Math.max(min, config.thinkMaxSeconds);
  return min + Math.random() * (max - min);
}

export function pause(seconds = 1) {
  sleep(seconds);
}
