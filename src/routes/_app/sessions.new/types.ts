import { Shuffle, TrendingDown, TrendingUp, Hash } from "lucide-react";

export type CategoryRow = { id: string; name: string };
export type SubcategoryRow = { id: string; category_id: string; name: string };
export type TypeRow = { id: string; name: string };
export type SubtypeRow = { id: string; type_id: string; name: string };

export type DifficultyCustom = { easy: number; medium: number; hard: number; enabled: boolean };
export type PickStrategy = "random" | "least_used" | "most_used" | "newest" | "oldest";

export type FieldErrors = {
  title?: string;
  category?: string;
  quizType?: string;
  time?: string;
  schedule?: string;
  subtypes?: string;
};

export const PICK_STRATEGY_DEFS: {
  value: PickStrategy;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
}[] = [
  { value: "random", labelKey: "newSess.psRandom", descKey: "newSess.psRandomDesc", icon: Shuffle },
  {
    value: "least_used",
    labelKey: "newSess.psLeastUsed",
    descKey: "newSess.psLeastUsedDesc",
    icon: TrendingDown,
  },
  {
    value: "most_used",
    labelKey: "newSess.psMostUsed",
    descKey: "newSess.psMostUsedDesc",
    icon: TrendingUp,
  },
  { value: "newest", labelKey: "newSess.psNewest", descKey: "newSess.psNewestDesc", icon: Hash },
  { value: "oldest", labelKey: "newSess.psOldest", descKey: "newSess.psOldestDesc", icon: Hash },
];

export const QUIZ_TYPES = [
  { value: "mcq", label: "MCQ (Multiple Choice)", desc: "Only multiple-choice questions" },
  { value: "true_false", label: "True / False", desc: "Only true/false statements" },
  { value: "short_answer", label: "Short Answer", desc: "Only short-answer questions" },
  { value: "long_answer", label: "Long Answer (Essay)", desc: "Only essay-style questions" },
  { value: "mixed", label: "Mixed", desc: "All question types together" },
];
