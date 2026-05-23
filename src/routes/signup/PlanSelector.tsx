import { Check, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { GoogleIcon } from "../login/GoogleIcon";
import { USER_TYPES } from "./constants";

interface PlanSelectorProps {
  selectedPlan: string;
  onSelect: (slug: string) => void;
  onContinue: () => void;
  onGoogle: () => void;
  loading: boolean;
}

export function PlanSelector({
  selectedPlan,
  onSelect,
  onContinue,
  onGoogle,
  loading,
}: PlanSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="-mt-2 mb-1">
        <p className="text-base font-semibold">How will you use EvaluTease?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick the one that fits you, you can always change later.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {USER_TYPES.map((type) => {
          const Icon = type.icon;
          const active = selectedPlan === type.slug;
          return (
            <button
              key={type.slug}
              type="button"
              onClick={() => onSelect(type.slug)}
              className={`w-full text-left rounded-2xl border p-5 transition-all ${active ? type.activeBorder : type.inactiveBorder}`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-secondary/60 shrink-0 ${type.color}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{type.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{type.desc}</div>
                  <div className={`text-xs font-semibold mt-1.5 ${type.color}`}>{type.note}</div>
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
      >
        Continue <ChevronRight size={16} className="ml-1" />
      </Button>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 gap-3 bg-secondary/40 hover:bg-secondary text-base"
        onClick={onGoogle}
        disabled={loading}
      >
        <GoogleIcon />
        <span className="font-semibold">{t("auth.continueGoogle")}</span>
      </Button>
      <p className="text-center text-sm text-muted-foreground pt-1">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          {t("auth.signin")}
        </Link>
      </p>
    </div>
  );
}
