import { Bug, HelpCircle, Lightbulb, TrendingUp } from "lucide-react";

export type FeedbackRow = {
  id: string;
  session_id: string;
  session_title: string;
  participant_name: string;
  participant_email: string | null;
  rating: number;
  comment: string | null;
  submitted_at: string;
};

export type SessionStat = {
  id: string;
  title: string;
  created_at: string;
  participant_count: number;
  avg_pct: number;
  highest_pct: number;
  lowest_pct: number;
  total_correct: number;
  total_wrong: number;
  total_unattempted: number;
  avg_rating: number | null;
  review_count: number;
};

export type AppFeedbackRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  created_at: string;
};

export const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug report", icon: Bug },
  { value: "feature", label: "Feature request", icon: Lightbulb },
  { value: "improvement", label: "Improvement idea", icon: TrendingUp },
  { value: "other", label: "Other", icon: HelpCircle },
] as const;

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const PRIORITY_CLS: Record<string, { active: string }> = {
  low: { active: "border-success/50 bg-success/15 text-success" },
  medium: { active: "border-primary/50 bg-primary/15 text-primary" },
  high: { active: "border-warning/50 bg-warning/15 text-warning" },
  critical: { active: "border-destructive/50 bg-destructive/15 text-destructive" },
};
