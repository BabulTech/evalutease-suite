import type React from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Activity,
  Zap,
  PlayCircle,
  MessageSquare,
  AlertTriangle,
  UsersRound,
  FolderTree,
  Tag,
  Coins,
  Wallet,
  Globe,
} from "lucide-react";

export type NavItem = { key: string; label: string; icon: React.ElementType; badge?: number };

export const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "participants", label: "Participants", icon: UsersRound },
  { key: "quizzes", label: "Quizzes", icon: PlayCircle },
  { key: "categories", label: "Categories", icon: FolderTree },
  { key: "reviews", label: "Reviews", icon: CreditCard },
  { key: "appfeedback", label: "App Feedback", icon: MessageSquare },
  { key: "activity", label: "Activity Logs", icon: Activity },
  { key: "aiusage", label: "AI Usage", icon: Zap },
  { key: "alerts", label: "Security Alerts", icon: AlertTriangle },
  { key: "plans", label: "Plans", icon: CreditCard },
  { key: "credits", label: "Credits", icon: Coins },
  { key: "packages", label: "Credit Packages", icon: Wallet },
  { key: "domains", label: "Blocked Domains", icon: Globe },
  { key: "promocodes", label: "Promo Codes", icon: Tag },
  { key: "finance", label: "Finance", icon: DollarSign },
];

export const NAV_GROUPS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, sections: ["overview"] },
  { key: "people", label: "People", icon: Users, sections: ["users", "participants"] },
  { key: "content", label: "Content", icon: PlayCircle, sections: ["quizzes", "categories"] },
  { key: "feedback", label: "Feedback", icon: MessageSquare, sections: ["reviews", "appfeedback"] },
  { key: "monitor", label: "Monitor", icon: Activity, sections: ["activity", "aiusage", "alerts"] },
  {
    key: "money",
    label: "Money",
    icon: Wallet,
    sections: ["plans", "credits", "packages", "domains", "promocodes", "finance"],
  },
] as const;

export function getNavGroup(section: string) {
  return (
    NAV_GROUPS.find((group) => (group.sections as readonly string[]).includes(section)) ??
    NAV_GROUPS[0]
  );
}
