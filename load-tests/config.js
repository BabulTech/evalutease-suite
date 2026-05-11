export const config = {
  appBaseUrl: (__ENV.BASE_URL || "http://localhost:8082").replace(/\/$/, ""),
  supabaseUrl: (__ENV.SUPABASE_URL || __ENV.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  supabaseAnonKey: __ENV.SUPABASE_ANON_KEY || __ENV.SUPABASE_PUBLISHABLE_KEY || __ENV.VITE_SUPABASE_PUBLISHABLE_KEY || "",

  quizCode: __ENV.QUIZ_CODE || "TEST",
  quizCodes: parseList(__ENV.QUIZ_CODES || __ENV.QUIZ_CODE || "TEST"),
  quizSelection: (__ENV.QUIZ_SELECTION || "balanced").toLowerCase(),
  questionCount: Number(__ENV.QUESTION_COUNT || 20),
  answerBatchSize: Number(__ENV.ANSWER_BATCH_SIZE || 5),
  thinkMinSeconds: Number(__ENV.THINK_MIN_SECONDS || 1),
  thinkMaxSeconds: Number(__ENV.THINK_MAX_SECONDS || 5),
  realtimeHoldSeconds: Number(__ENV.REALTIME_HOLD_SECONDS || 30),

  teacherEmail: __ENV.TEACHER_EMAIL || "",
  teacherPassword: __ENV.TEACHER_PASSWORD || "",
  teacherSessionId: __ENV.TEACHER_SESSION_ID || __ENV.TEST_SESSION_ID || "",
  teacherSessionIds: parseList(__ENV.TEACHER_SESSION_IDS || __ENV.TEACHER_SESSION_ID || __ENV.TEST_SESSION_ID || ""),
  enableTeacherScenario: (__ENV.ENABLE_TEACHERS || "false").toLowerCase() === "true",
  teacherMonitorSeconds: Number(__ENV.TEACHER_MONITOR_SECONDS || 30),

  allowTeacherMutations: (__ENV.ALLOW_TEACHER_MUTATIONS || "false").toLowerCase() === "true",
  allowTeacherPauseResume: (__ENV.ALLOW_TEACHER_PAUSE_RESUME || "false").toLowerCase() === "true",
  allowSessionClose: (__ENV.ALLOW_SESSION_CLOSE || "false").toLowerCase() === "true",
  enableRealtime: (__ENV.ENABLE_REALTIME || "false").toLowerCase() === "true",

  dashboardPageSize: Number(__ENV.DASHBOARD_PAGE_SIZE || 20),
  runDuration: __ENV.RUN_DURATION || "3m",
  gracefulStop: __ENV.GRACEFUL_STOP || "30s",
};

export const loadLevels = {
  smoke: { vus: 5, duration: __ENV.RUN_DURATION || "1m" },
  small: { vus: 10, duration: __ENV.RUN_DURATION || "3m" },
  medium: { vus: 50, duration: __ENV.RUN_DURATION || "5m" },
  large: { vus: 100, duration: __ENV.RUN_DURATION || "8m" },
  stress: { vus: 300, duration: __ENV.RUN_DURATION || "10m" },
};

export const schoolProfiles = {
  small_school: { classes: 3, studentsPerClass: 20, participants: 60, duration: __ENV.RUN_DURATION || "5m" },
  medium_school: { classes: 5, studentsPerClass: 30, participants: 150, duration: __ENV.RUN_DURATION || "8m" },
  five_class_100: { classes: 5, studentsPerClass: 100, participants: 500, duration: __ENV.RUN_DURATION || "10m" },
  large_school: { classes: 10, studentsPerClass: 50, participants: 500, duration: __ENV.RUN_DURATION || "10m" },
  stress_school: { classes: 20, studentsPerClass: 50, participants: 1000, duration: __ENV.RUN_DURATION || "12m" },
};

export function selectedLoadLevel() {
  const name = (__ENV.TEST_LEVEL || "small").toLowerCase();
  return loadLevels[name] ? { name, ...loadLevels[name] } : { name: "small", ...loadLevels.small };
}

export function selectedSchoolProfile() {
  const name = (__ENV.SCHOOL_PROFILE || "small_school").toLowerCase();
  return schoolProfiles[name] ? { name, ...schoolProfiles[name] } : { name: "small_school", ...schoolProfiles.small_school };
}

export function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
