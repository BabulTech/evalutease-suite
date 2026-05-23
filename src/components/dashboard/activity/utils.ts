import {
  Activity,
  Play,
  Pause,
  StopCircle,
  CheckCircle2,
  Trash2,
  Calendar,
  Mail,
  Plus,
  UserPlus,
  FileText,
  MessageSquare,
  CreditCard,
  Coins,
  AlertTriangle,
} from "lucide-react";
import type { RecentActivityRow } from "./types";

const TONE_SUCCESS = "text-success";
const TONE_MUTED = "text-muted-foreground";
const TONE_PRIMARY = "text-primary";

// eslint-disable-next-line sonarjs/cognitive-complexity -- icon dispatch switch with many action types
export function iconFor(row: RecentActivityRow) {
  const a = row.action_type;
  switch (row.module) {
    case "sessions":
      if (a === "created") return { Icon: Plus, tone: TONE_PRIMARY };
      if (a === "scheduled") return { Icon: Calendar, tone: TONE_PRIMARY };
      if (a === "started") return { Icon: Play, tone: TONE_SUCCESS };
      if (a === "paused") return { Icon: Pause, tone: "text-warning" };
      if (a === "resumed") return { Icon: Play, tone: TONE_SUCCESS };
      if (a === "closed") return { Icon: StopCircle, tone: "text-warning" };
      if (a === "completed") return { Icon: CheckCircle2, tone: TONE_SUCCESS };
      if (a === "finalized") return { Icon: CheckCircle2, tone: TONE_SUCCESS };
      if (a === "deleted") return { Icon: Trash2, tone: "text-destructive" };
      if (a === "reminder_sent") return { Icon: Mail, tone: TONE_PRIMARY };
      if (a === "joined") return { Icon: UserPlus, tone: TONE_MUTED };
      if (a === "submitted") return { Icon: FileText, tone: TONE_SUCCESS };
      break;
    case "grading":
      return { Icon: CheckCircle2, tone: TONE_SUCCESS };
    case "feedback":
      return { Icon: MessageSquare, tone: TONE_PRIMARY };
    case "billing":
      if (a === "credit_added") return { Icon: Coins, tone: TONE_SUCCESS };
      if (a === "credit_spent") return { Icon: Coins, tone: "text-warning" };
      if (a === "rejected") return { Icon: AlertTriangle, tone: "text-destructive" };
      return { Icon: CreditCard, tone: TONE_PRIMARY };
  }
  return { Icon: Activity, tone: TONE_MUTED };
}

export function linkFor(row: RecentActivityRow): string | null {
  if (row.module === "sessions" && row.entity_type === "quiz_session" && row.entity_id)
    return `/sessions/${row.entity_id}`;
  if (
    row.module === "sessions" &&
    (row.entity_type === "quiz_attempt" || row.entity_type === "quiz_answer")
  ) {
    const sid = (row.details as { session_id?: string } | null)?.session_id;
    if (sid) return `/sessions/${sid}`;
  }
  if (row.module === "billing") return "/billing";
  if (row.module === "feedback") return "/settings";
  return null;
}

export function formatRelative(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
