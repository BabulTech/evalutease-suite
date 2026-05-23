export type Stats = {
  sessions: number;
  active: number;
  participants: number;
  questions: number;
};

export type CreditTx = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
};

export type RecentSession = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  completed: "bg-primary/15 text-primary",
  scheduled: "bg-warning/15 text-warning",
  draft: "bg-muted/40 text-muted-foreground",
};
