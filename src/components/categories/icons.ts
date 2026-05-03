import {
  BookOpen,
  Briefcase,
  Calculator,
  Clapperboard,
  Code,
  FlaskConical,
  Globe2,
  GraduationCap,
  Handshake,
  Heart,
  Landmark,
  Languages,
  Music,
  Palette,
  Presentation,
  Trophy,
  UserRound,
  Users,
  Volleyball,
  type LucideIcon,
} from "lucide-react";

export type IconKey =
  | "book"
  | "history"
  | "science"
  | "math"
  | "language"
  | "sport"
  | "trophy"
  | "religion"
  | "music"
  | "art"
  | "code"
  | "geography"
  | "film"
  | "student"
  | "teacher"
  | "colleague"
  | "partner"
  | "friends"
  | "users"
  | "person";

type IconMeta = { key: IconKey; label: string; icon: LucideIcon };

export const CATEGORY_ICONS: IconMeta[] = [
  { key: "book", label: "General / Book", icon: BookOpen },
  { key: "history", label: "History", icon: Landmark },
  { key: "science", label: "Science", icon: FlaskConical },
  { key: "math", label: "Math", icon: Calculator },
  { key: "language", label: "Language", icon: Languages },
  { key: "sport", label: "Sports", icon: Volleyball },
  { key: "trophy", label: "Trophy / Awards", icon: Trophy },
  { key: "religion", label: "Religion", icon: Heart },
  { key: "music", label: "Music", icon: Music },
  { key: "art", label: "Art", icon: Palette },
  { key: "code", label: "Programming", icon: Code },
  { key: "geography", label: "Geography", icon: Globe2 },
  { key: "film", label: "Film / Media", icon: Clapperboard },
];

export const PARTICIPANT_TYPE_ICONS: IconMeta[] = [
  { key: "student", label: "Student", icon: GraduationCap },
  { key: "teacher", label: "Teacher", icon: Presentation },
  { key: "colleague", label: "Colleague", icon: Briefcase },
  { key: "partner", label: "Partner", icon: Handshake },
  { key: "friends", label: "Friends", icon: Users },
  { key: "users", label: "Group / Team", icon: UserRound },
  { key: "trophy", label: "Champions", icon: Trophy },
  { key: "person", label: "Person", icon: UserRound },
];

const ALL_ICONS = new Map<IconKey, LucideIcon>();
for (const m of CATEGORY_ICONS) ALL_ICONS.set(m.key, m.icon);
for (const m of PARTICIPANT_TYPE_ICONS) ALL_ICONS.set(m.key, m.icon);

export function iconFor(key: string | null | undefined): LucideIcon {
  if (!key) return BookOpen;
  return ALL_ICONS.get(key as IconKey) ?? BookOpen;
}
