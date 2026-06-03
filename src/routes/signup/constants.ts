import { z } from "zod";
import { User, Building2 } from "lucide-react";

export const USER_TYPES = [
  {
    slug: "individual_starter",
    label: "Personal",
    desc: "I'm an individual teacher, trainer, or student",
    icon: User,
    color: "text-primary",
    activeBorder: "border-primary/60 bg-primary/5 ring-2 ring-primary/40",
    inactiveBorder: "border-border bg-secondary/20 hover:border-primary/40",
    note: "Start free forever",
  },
  {
    slug: "enterprise_free",
    label: "Enterprise",
    desc: "We're a school, company, or team",
    icon: Building2,
    color: "text-yellow-400",
    activeBorder: "border-yellow-400/60 bg-yellow-400/5 ring-2 ring-yellow-400/40",
    inactiveBorder: "border-border bg-secondary/20 hover:border-yellow-400/40",
    note: "10 free AI calls included",
  },
] as const;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .refine((v) => /[A-Z]/.test(v), "Must contain an uppercase letter")
  .refine((v) => /[a-z]/.test(v), "Must contain a lowercase letter")
  .refine((v) => /[0-9]/.test(v), "Must contain a number")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Must contain a special character");

export function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Very weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "bg-orange-500" };
  if (score === 3) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 4) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

export const PW_RULES = [
  { test: (v: string) => v.length >= 8, label: "At least 8 characters" },
  { test: (v: string) => /[A-Z]/.test(v), label: "One uppercase letter" },
  { test: (v: string) => /[a-z]/.test(v), label: "One lowercase letter" },
  { test: (v: string) => /[0-9]/.test(v), label: "One number" },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: "One special character (!@#$…)" },
];

export const SIGNUP_STEPS = [
  "Creating your account…",
  "Setting up your workspace…",
  "Configuring your plan…",
  "Almost ready…",
];

export const USE_CASES = ["Education", "Sports", "Fun", "Religion", "Science", "Academic"] as const;
export const ROLES = ["Student", "Teacher", "Employer", "Other"] as const;
export const REFERRALS = [
  "Ads",
  "Friend Recommendation",
  "Employee Referral",
  "Web Search",
] as const;
export const REFERRAL_KEYS: Record<string, string> = {
  Ads: "signup.referral.ads",
  "Friend Recommendation": "signup.referral.friend",
  "Employee Referral": "signup.referral.employee",
  "Web Search": "signup.referral.webSearch",
};
export const INDUSTRIES = [
  "Education",
  "Technology",
  "Healthcare",
  "Finance",
  "Retail",
  "Government",
  "Non-profit",
  "Other",
] as const;
export const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;

// Enterprise account types. Schools/universities may use any email; every
// other organisation type must register with a work (organisation) email.
export const ENTERPRISE_TYPES = [
  { value: "school", label: "School / University" },
  { value: "company", label: "Company / Business" },
  { value: "other", label: "Other organisation" },
] as const;

// Common free / personal email providers. Non-school enterprise accounts are
// blocked from using these so company workspaces map to a real organisation.
export const FREE_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "rocketmail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com",
  "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "zoho.com",
];

export function isFreeEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return FREE_EMAIL_DOMAINS.includes(domain);
}

// True when a work email is required: enterprise accounts whose type is set and
// is anything other than a school.
export function requiresWorkEmail(category: string, enterpriseType?: string): boolean {
  return category === "enterprise" && !!enterpriseType && enterpriseType !== "school";
}
export const GRADE_YEARS = [
  "Grade 1–5",
  "Grade 6–8",
  "Grade 9–10",
  "Grade 11–12",
  "Undergraduate",
  "Postgraduate",
  "PhD",
  "Other",
] as const;
