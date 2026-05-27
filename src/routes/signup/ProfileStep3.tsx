import { type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { ChipButton, FieldError } from "./-components";
import { USE_CASES, REFERRALS, REFERRAL_KEYS } from "./constants";
import type { SignupFormData, FieldErrors } from "./-schema";

type FormState = SignupFormData & { useCases: string[] };
type SetForm = React.Dispatch<React.SetStateAction<FormState>>;

interface Props {
  form: FormState;
  setForm: SetForm;
  errors: FieldErrors;
  setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  selectedPlan: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
  onChangePlan: () => void;
  isPaid?: boolean;
}

export function ProfileStep3({
  form,
  setForm,
  errors,
  setErrors,
  selectedPlan,
  loading,
  onSubmit,
  onBack,
  onChangePlan,
  isPaid = false,
}: Props) {
  const { t } = useI18n();
  const clearError = (k: string) => setErrors((prev) => ({ ...prev, [k]: undefined }));

  const toggleUseCase = (val: string) =>
    setForm((f) => ({
      ...f,
      useCases: f.useCases.includes(val)
        ? f.useCases.filter((u) => u !== val)
        : [...f.useCases, val],
    }));

  const planLabel = selectedPlan.includes("enterprise") ? "Enterprise" : "Personal";
  const tierLabel = selectedPlan.includes("pro") ? "Pro" : "Free";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label className="mb-2 text-xs block">{t("signup.useFor")}</Label>
        <div className="flex flex-wrap gap-2">
          {USE_CASES.map((uc) => (
            <ChipButton
              key={uc}
              active={form.useCases.includes(uc)}
              onClick={() => toggleUseCase(uc)}
            >
              {t(`signup.useCase.${uc.toLowerCase()}`)}
            </ChipButton>
          ))}
        </div>
        <FieldError msg={errors.useCases} />
      </div>

      <div>
        <Label className="mb-2 text-xs block">{t("signup.hearAbout")}</Label>
        <div className="flex flex-wrap gap-2">
          {REFERRALS.map((r) => (
            <ChipButton
              key={r}
              active={form.referral === r}
              onClick={() => { setForm((f) => ({ ...f, referral: r })); clearError("referral"); }}
            >
              {t(REFERRAL_KEYS[r] ?? r)}
            </ChipButton>
          ))}
        </div>
        <FieldError msg={errors.referral} />
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
        <span className="text-xs text-muted-foreground">Plan:</span>
        <span className="text-xs font-bold text-primary">{planLabel} · {tierLabel}</span>
        <button
          type="button"
          onClick={onChangePlan}
          className="ml-auto text-xs text-primary hover:underline min-h-[32px] px-2"
        >
          Change
        </button>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 px-4" onClick={onBack}>
          <ChevronLeft size={16} />
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 h-12 bg-gradient-primary font-semibold shadow-glow hover:opacity-90 text-base"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Creating…
            </span>
          ) : isPaid ? (
            <>Continue <ChevronRight size={16} className="ml-1" /></>
          ) : (
            t("signup.createAccount")
          )}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground pb-1">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          {t("auth.signin")}
        </Link>
      </p>
    </form>
  );
}
