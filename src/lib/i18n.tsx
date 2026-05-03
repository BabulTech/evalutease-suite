import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "ur";

type Dict = Record<string, string>;

const dictionaries: Record<Language, Dict> = {
  en: {
    "app.name": "Babul.Quiz",
    "app.tagline": "Premium Live Quiz Platform",
    "auth.signin": "Sign In",
    "auth.signup": "Sign Up",
    "auth.login": "Log in",
    "auth.title": "Log in",
    "auth.subtitle": "Free for up to 50 students · 3 quizzes per day on Free tier",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.firstName": "First name",
    "auth.lastName": "Last name",
    "auth.organization": "Organization / School",
    "auth.mobile": "Mobile number",
    "auth.continueGoogle": "Continue with Google",
    "auth.or": "OR",
    "auth.noAccount": "Don't have an account?",
    "auth.haveAccount": "Already have an account?",
    "auth.forgot": "Forgot password?",
    "auth.reset": "Reset password",
    "auth.resetSent": "Check your email for a reset link.",
    "auth.logout": "Log out",
    "nav.dashboard": "Dashboard",
    "nav.questions": "Questions",
    "nav.participants": "Participants",
    "nav.manageCategories": "Manage Categories",
    "nav.manageParticipants": "Manage Participants",
    "nav.sessions": "Quiz Sessions",
    "nav.quizHistory": "Quiz History",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "dash.welcome": "Welcome back",
    "dash.quizzes": "Total Quizzes",
    "dash.sessions": "Sessions Started",
    "dash.participants": "Participants",
    "dash.questions": "Questions Created",
    "dash.recentSessions": "Recent Sessions",
    "dash.upcoming": "Upcoming Sessions",
    "dash.quickActions": "Quick Actions",
    "dash.createQuiz": "Create New Quiz",
    "dash.createQuestions": "Create Questions",
    "dash.manageParticipants": "Manage Participants",
    "dash.startSession": "Start Quiz Session",
    "dash.generateQR": "Generate QR Session",
    "dash.empty": "Nothing here yet — start by creating a quiz.",
    "common.loading": "Loading…",
    "common.comingSoon": "Coming soon",
    "lang.english": "English",
    "lang.urdu": "اردو",
  },
  ur: {
    "app.name": "بابل کوئز",
    "app.tagline": "پریمیم لائیو کوئز پلیٹ فارم",
    "auth.signin": "سائن ان",
    "auth.signup": "سائن اپ",
    "auth.login": "لاگ ان",
    "auth.title": "لاگ ان کریں",
    "auth.subtitle": "مفت میں 50 طلباء تک · فری ٹیئر پر روزانہ 3 کوئز",
    "auth.email": "ای میل",
    "auth.password": "پاس ورڈ",
    "auth.firstName": "پہلا نام",
    "auth.lastName": "آخری نام",
    "auth.organization": "ادارہ / اسکول",
    "auth.mobile": "موبائل نمبر",
    "auth.continueGoogle": "گوگل کے ساتھ جاری رکھیں",
    "auth.or": "یا",
    "auth.noAccount": "اکاؤنٹ نہیں ہے؟",
    "auth.haveAccount": "پہلے سے اکاؤنٹ موجود ہے؟",
    "auth.forgot": "پاس ورڈ بھول گئے؟",
    "auth.reset": "پاس ورڈ ری سیٹ کریں",
    "auth.resetSent": "ری سیٹ لنک کے لیے اپنی ای میل دیکھیں۔",
    "auth.logout": "لاگ آؤٹ",
    "nav.dashboard": "ڈیش بورڈ",
    "nav.questions": "سوالات",
    "nav.participants": "شرکاء",
    "nav.manageCategories": "زمرے منظم کریں",
    "nav.manageParticipants": "شرکاء منظم کریں",
    "nav.sessions": "کوئز سیشنز",
    "nav.quizHistory": "کوئز ہسٹری",
    "nav.reports": "رپورٹس",
    "nav.settings": "ترتیبات",
    "dash.welcome": "خوش آمدید",
    "dash.quizzes": "کل کوئز",
    "dash.sessions": "شروع کردہ سیشنز",
    "dash.participants": "شرکاء",
    "dash.questions": "تخلیق کردہ سوالات",
    "dash.recentSessions": "حالیہ سیشنز",
    "dash.upcoming": "آنے والے سیشنز",
    "dash.quickActions": "فوری اقدامات",
    "dash.createQuiz": "نیا کوئز بنائیں",
    "dash.createQuestions": "سوالات بنائیں",
    "dash.manageParticipants": "شرکاء کا انتظام",
    "dash.startSession": "کوئز سیشن شروع کریں",
    "dash.generateQR": "کیو آر سیشن بنائیں",
    "dash.empty": "ابھی یہاں کچھ نہیں — کوئز بنا کر شروع کریں۔",
    "common.loading": "لوڈ ہو رہا ہے…",
    "common.comingSoon": "جلد آرہا ہے",
    "lang.english": "English",
    "lang.urdu": "اردو",
  },
};

type I18nCtx = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("bq.lang") as Language | null;
    if (stored === "en" || stored === "ur") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Language) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("bq.lang", l);
  };

  const t = (key: string) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key;

  return (
    <Ctx.Provider value={{ lang, setLang, t, dir: lang === "ur" ? "rtl" : "ltr" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
