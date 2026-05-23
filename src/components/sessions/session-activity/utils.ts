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
} from "lucide-react";

export function iconForAction(action: string) {
  switch (action) {
    case "created":
      return { Icon: Plus, tone: "text-primary" };
    case "scheduled":
      return { Icon: Calendar, tone: "text-primary" };
    case "started":
      return { Icon: Play, tone: "text-success" };
    case "paused":
      return { Icon: Pause, tone: "text-warning" };
    case "resumed":
      return { Icon: Play, tone: "text-success" };
    case "closed":
      return { Icon: StopCircle, tone: "text-warning" };
    case "completed":
      return { Icon: CheckCircle2, tone: "text-success" };
    case "finalized":
      return { Icon: CheckCircle2, tone: "text-success" };
    case "deleted":
      return { Icon: Trash2, tone: "text-destructive" };
    case "reminder_sent":
      return { Icon: Mail, tone: "text-primary" };
    default:
      return { Icon: Activity, tone: "text-muted-foreground" };
  }
}

export function formatRelative(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
