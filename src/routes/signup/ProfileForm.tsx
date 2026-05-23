import { type MutableRefObject, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { ChipButton, RoleButton, FieldError } from "./-components";
import { RoleDetails } from "./RoleDetails";
import { EmailField } from "./EmailField";
import { PasswordField } from "./PasswordField";
import { ROLES, USE_CASES, REFERRALS, REFERRAL_KEYS, USER_TYPES } from "./constants";
import type { SignupFormData, FieldErrors } from "./-schema";

type FormState = SignupFormData & { useCases: string[] };
type SetForm = React.Dispatch<React.SetStateAction<FormState>>;

interface ProfileFormProps {
  form: FormState;
  setForm: SetForm;
  errors: FieldErrors;
  setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  selectedPlan: string;
  loading: boolean;
  firstNameRef: MutableRefObject<HTMLInputElement | null>;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
  onChangePlan: () => void;
  onEmailCheckChange: (state: "idle" | "checking" | "taken" | "available") => void;
}

export function ProfileForm({
  form,
  setForm,
  errors,
  setErrors,
  selectedPlan,
  loading,
  firstNameRef,
  onSubmit,
  onBack,
  onChangePlan,
  onEmailCheckChange,
}: ProfileFormProps) {
  const { t } = useI18n();

  const clearError = (k: string) => setErrors((prev) => ({ ...prev, [k]: undefined }));

  const toggleUseCase = (val: string) =>
    setForm((f) => ({
      ...f,
      useCases: f.useCases.includes(val)
        ? f.useCases.filter((u) => u !== val)
        : [...f.useCases, val],
    }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName" className="mb-1.5 text-xs">
            {t("auth.firstName")}
          </Label>
          <Input
            id="firstName"
            ref={firstNameRef}
            value={form.firstName}
            onChange={(e) => {
              setForm((f) => ({ ...f, firstName: e.target.value }));
              clearError("firstName");
            }}
            placeholder="Ali"
            className={`h-12 text-base ${errors.firstName ? "border-destructive" : ""}`}
            autoComplete="given-name"
            aria-invalid={!!errors.firstName}
          />
          <FieldError msg={errors.firstName} />
        </div>
        <div>
          <Label htmlFor="lastName" className="mb-1.5 text-xs">
            {t("auth.lastName")}
          </Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) => {
              setForm((f) => ({ ...f, lastName: e.target.value }));
              clearError("lastName");
            }}
            placeholder="Khan"
            className={`h-12 text-base ${errors.lastName ? "border-destructive" : ""}`}
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
          />
          <FieldError msg={errors.lastName} />
        </div>
      </div>

      <div>
        <Label className="mb-2 text-xs block">{t("signup.iAm")}</Label>
        <div className="flex gap-2 flex-wrap">
          {ROLES.map((r) => (
            <RoleButton
              key={r}
              active={form.role === r}
              onClick={() => {
                setForm((f) => ({ ...f, role: r }));
                clearError("role");
              }}
            >
              {t(`signup.role.${r.toLowerCase()}`)}
            </RoleButton>
          ))}
        </div>
        <FieldError msg={errors.role} />
      </div>

      <div>
        <Label htmlFor="mobile" className="mb-1.5 text-xs">
          {t("auth.mobile")} <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="mobile"
          value={form.mobile ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
          type="tel"
          inputMode="tel"
          placeholder="+92 300 0000000"
          className="h-12 text-base"
          autoComplete="tel"
        />
      </div>

      <RoleDetails role={form.role} form={form} setForm={setForm} />

      <EmailField
        value={form.email}
        onChange={(v) => {
          setForm((f) => ({ ...f, email: v }));
          clearError("email");
        }}
        onCheckStateChange={onEmailCheckChange}
        error={errors.email}
      />

      <PasswordField
        value={form.password}
        onChange={(v) => {
          setForm((f) => ({ ...f, password: v }));
          clearError("password");
        }}
        error={errors.password}
      />

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
              onClick={() => {
                setForm((f) => ({ ...f, referral: r }));
                clearError("referral");
              }}
            >
              {t(REFERRAL_KEYS[r] ?? r)}
            </ChipButton>
          ))}
        </div>
        <FieldError msg={errors.referral} />
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
        <span className="text-xs text-muted-foreground">Account type:</span>
        <span className="text-xs font-bold text-primary">
          {USER_TYPES.find((p) => p.slug === selectedPlan)?.label}
        </span>
        <button
          type="button"
          onClick={onChangePlan}
          className="ml-auto text-xs text-primary hover:underline min-h-[32px] px-2"
        >
          Change
        </button>
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="size-12 shrink-0 p-0"
          onClick={onBack}
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 h-12 bg-gradient-primary font-semibold shadow-glow hover:opacity-90 text-base"
        >
          {t("signup.createAccount")}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground pb-2">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          {t("auth.signin")}
        </Link>
      </p>
    </form>
  );
}
