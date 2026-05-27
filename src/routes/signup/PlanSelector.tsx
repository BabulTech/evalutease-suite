import { Check, ChevronRight, User, Building2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  {
    slug: "personal",
    label: "Personal",
    desc: "I am an individual teacher, trainer, student or professional",
    icon: User,
    color: "text-primary",
    activeBorder: "border-primary/60 bg-primary/5 ring-2 ring-primary/40",
    inactiveBorder: "border-border bg-secondary/20 hover:border-primary/40",
  },
  {
    slug: "enterprise",
    label: "Enterprise",
    desc: "We are a Company or Educational Institute",
    icon: Building2,
    color: "text-yellow-400",
    activeBorder: "border-yellow-400/60 bg-yellow-400/5 ring-2 ring-yellow-400/40",
    inactiveBorder: "border-border bg-secondary/20 hover:border-yellow-400/40",
  },
] as const;

interface PlanSelectorProps {
  selectedCategory: string;
  onSelect: (slug: string) => void;
  onContinue: () => void;
}

export function PlanSelector({ selectedCategory, onSelect, onContinue }: PlanSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelect(cat.slug)}
              className={`w-full text-left rounded-2xl border p-5 transition-all ${active ? cat.activeBorder : cat.inactiveBorder}`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-secondary/60 shrink-0 ${cat.color}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{cat.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cat.desc}</div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? "border-primary bg-primary" : "border-border"}`}
                >
                  {active && <Check size={12} className="text-primary-foreground" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        className="w-full h-12 bg-gradient-primary font-semibold shadow-glow text-base"
        onClick={onContinue}
        disabled={!selectedCategory}
      >
        Continue <ChevronRight size={16} className="ml-1" />
      </Button>

      <p className="text-center text-sm text-muted-foreground pt-1">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}
