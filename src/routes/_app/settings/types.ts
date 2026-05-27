export const DEFAULT_MESSAGES = {
  lobby_title: "Welcome to the Quiz Lobby!",
  lobby_subtitle: "Please wait while the host starts the quiz.",
  lobby_waiting: "You're all set. The quiz will begin shortly.",
  completion_title: "Quiz Completed!",
  completion_subtitle: "Thanks for participating. The host will announce the final results.",
  registration_welcome: "Enter your details to join the quiz.",
};

export type AppMessages = typeof DEFAULT_MESSAGES;

export const MESSAGE_FIELD_KEYS: {
  key: keyof AppMessages;
  labelKey: string;
  descKey: string;
  multiline?: boolean;
}[] = [
  { key: "lobby_title", labelKey: "settings.msgLobbyTitle", descKey: "settings.msgLobbyTitleDesc" },
  {
    key: "lobby_subtitle",
    labelKey: "settings.msgLobbySubtitle",
    descKey: "settings.msgLobbySubtitleDesc",
  },
  {
    key: "lobby_waiting",
    labelKey: "settings.msgLobbyWaiting",
    descKey: "settings.msgLobbyWaitingDesc",
    multiline: true,
  },
  {
    key: "completion_title",
    labelKey: "settings.msgCompletionTitle",
    descKey: "settings.msgCompletionTitleDesc",
  },
  {
    key: "completion_subtitle",
    labelKey: "settings.msgCompletionSubtitle",
    descKey: "settings.msgCompletionSubtitleDesc",
    multiline: true,
  },
  {
    key: "registration_welcome",
    labelKey: "settings.msgRegWelcome",
    descKey: "settings.msgRegWelcomeDesc",
    multiline: true,
  },
];

export const LIMIT_ROWS: { label: string; key: string }[] = [
  { label: "Quizzes / day", key: "quizzes_per_day" },
  { label: "AI calls / day", key: "ai_calls_per_day" },
  { label: "Participants / session", key: "participants_per_session" },
  { label: "Question bank", key: "question_bank" },
  { label: "Total sessions", key: "sessions_total" },
];

export const ROLES_OPTS = ["Student", "Teacher", "Employer", "Other"] as const;
export const ENTERPRISE_ROLES_OPTS = ["HR Manager", "Principal", "Admin", "Director", "Other"] as const;
export const USE_CASES_OPTS = [
  "Education",
  "Sports",
  "Fun",
  "Religion",
  "Science",
  "Academic",
] as const;
export const REFERRALS_OPTS = [
  "Ads",
  "Friend Recommendation",
  "Employee Referral",
  "Web Search",
] as const;
export const REFERRAL_KEYS_MAP: Record<string, string> = {
  Ads: "signup.referral.ads",
  "Friend Recommendation": "signup.referral.friend",
  "Employee Referral": "signup.referral.employee",
  "Web Search": "signup.referral.webSearch",
};
export const INDUSTRIES_OPTS = [
  "Education",
  "Technology",
  "Healthcare",
  "Finance",
  "Retail",
  "Government",
  "Non-profit",
  "Other",
] as const;
export const TEAM_SIZES_OPTS = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;
export const GRADE_YEARS_OPTS = [
  "Grade 1–5",
  "Grade 6–8",
  "Grade 9–10",
  "Grade 11–12",
  "Undergraduate",
  "Postgraduate",
  "PhD",
  "Other",
] as const;
