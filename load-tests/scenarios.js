import { selectedLoadLevel, selectedSchoolProfile, config } from "./config.js";

const level = selectedLoadLevel();
const school = selectedSchoolProfile();
const scenarioKind = (__ENV.K6_SCENARIO || "mixed").toLowerCase();

function splitUsers(total) {
  return {
    teachers: Math.max(1, Math.round(total * 0.05)),
    participants: Math.max(1, Math.round(total * 0.85)),
    publicVisitors: Math.max(1, total - Math.max(1, Math.round(total * 0.05)) - Math.max(1, Math.round(total * 0.85))),
  };
}

function constantScenario(exec, vus, tags) {
  return {
    executor: "constant-vus",
    vus,
    duration: level.duration,
    gracefulStop: config.gracefulStop,
    exec,
    tags,
  };
}

function smokeScenario(exec, vus, tags) {
  return {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "20s", target: vus },
      { duration: level.duration, target: vus },
      { duration: "20s", target: 0 },
    ],
    gracefulStop: config.gracefulStop,
    exec,
    tags,
  };
}

function scenarioMap() {
  if (scenarioKind === "public") {
    return { public_pages: smokeScenario("publicVisitorScenario", level.vus, { scenario: "public" }) };
  }
  if (scenarioKind === "teacher") {
    return { teachers: smokeScenario("teacherScenario", Math.min(level.vus, 5), { scenario: "teacher" }) };
  }
  if (scenarioKind === "participant") {
    return { participants: smokeScenario("participantScenario", level.vus, { scenario: "participant" }) };
  }
  if (scenarioKind === "realtime") {
    return { realtime: smokeScenario("realtimeScenario", level.vus, { scenario: "realtime" }) };
  }
  if (scenarioKind === "school") {
    const scenarios = {
      school_participants: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: "30s", target: school.participants },
          { duration: school.duration, target: school.participants },
          { duration: "30s", target: 0 },
        ],
        gracefulStop: config.gracefulStop,
        exec: "participantScenario",
        tags: {
          scenario: "school",
          school_profile: school.name,
          classes: String(school.classes),
        },
      },
    };

    if (config.enableTeacherScenario) {
      scenarios.school_teachers = {
        executor: "constant-vus",
        vus: school.classes,
        duration: school.duration,
        gracefulStop: config.gracefulStop,
        exec: "teacherScenario",
        tags: {
          scenario: "school_teachers",
          school_profile: school.name,
          classes: String(school.classes),
        },
      };
    }

    if (config.enableRealtime) {
      scenarios.school_realtime = {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: "30s", target: school.participants },
          { duration: school.duration, target: school.participants },
          { duration: "30s", target: 0 },
        ],
        gracefulStop: config.gracefulStop,
        exec: "realtimeScenario",
        tags: {
          scenario: "school_realtime",
          school_profile: school.name,
          classes: String(school.classes),
        },
      };
    }

    return scenarios;
  }

  const users = splitUsers(level.vus);
  return {
    public_pages: constantScenario("publicVisitorScenario", users.publicVisitors, { scenario: "public" }),
    teachers: constantScenario("teacherScenario", users.teachers, { scenario: "teacher" }),
    participants: constantScenario("participantScenario", users.participants, { scenario: "participant" }),
  };
}

function thresholds() {
  const base = {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{weight:normal}": ["p(95)<1000"],
    "http_req_duration{weight:heavy}": ["p(95)<2000"],
    http_req_duration: ["p(99)<2000"],
  };

  if ((scenarioKind === "teacher" || scenarioKind === "mixed") && __ENV.TEACHER_EMAIL && __ENV.TEACHER_PASSWORD) {
    base.login_success_rate = ["rate>0.90"];
  }

  if (scenarioKind === "participant" || scenarioKind === "mixed") {
    base.quiz_join_success_rate = ["rate>0.95"];
    base.session_load_success_rate = ["rate>0.95"];
    base.answer_submit_success_rate = ["rate>0.95"];
    base.complete_quiz_success_rate = ["rate>0.95"];
  }

  if (scenarioKind === "realtime") {
    base.realtime_connect_success_rate = ["rate>0.95"];
    base.realtime_session_isolation_rate = ["rate>0.99"];
  }

  if (scenarioKind === "school") {
    base.quiz_join_success_rate = ["rate>0.95"];
    base.session_load_success_rate = ["rate>0.95"];
    base.answer_submit_success_rate = ["rate>0.95"];
    base.complete_quiz_success_rate = ["rate>0.95"];
    if (config.enableTeacherScenario && __ENV.TEACHER_EMAIL && __ENV.TEACHER_PASSWORD) {
      base.login_success_rate = ["rate>0.90"];
      base.teacher_dashboard_success_rate = ["rate>0.90"];
    }
    if (config.enableRealtime) {
      base.realtime_connect_success_rate = ["rate>0.95"];
      base.realtime_session_isolation_rate = ["rate>0.99"];
    }
  }

  return base;
}

export const options = {
  scenarios: scenarioMap(),
  thresholds: thresholds(),
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};
