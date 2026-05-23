export type RecentActivityRow = {
  id: string;
  actor_name: string | null;
  action_type: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  message: string;
  details: Record<string, unknown> | null;
  risk_score: number;
  created_at: string;
};

export const MODULE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sessions", label: "Sessions" },
  { value: "grading", label: "Grading" },
  { value: "participants", label: "Participants" },
  { value: "questions", label: "Questions" },
  { value: "billing", label: "Billing" },
  { value: "auth", label: "Account" },
  { value: "admin", label: "Admin" },
];
