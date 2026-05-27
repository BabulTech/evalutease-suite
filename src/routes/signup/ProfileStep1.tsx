import { type MutableRefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { RoleButton, FieldError } from "./-components";
import { ROLES } from "./constants";
import type { SignupFormData, FieldErrors } from "./-schema";

type FormState = SignupFormData & { useCases: string[] };
type SetForm = React.Dispatch<React.SetStateAction<FormState>>;

const ENTERPRISE_ROLES = ["HR Manager", "Principal", "Admin", "Director", "Other"] as const;

interface Props {
  form: FormState;
  setForm: SetForm;
  errors: FieldErrors;
  setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  firstNameRef: MutableRefObject<HTMLInputElement | null>;
  category: string;
  onNext: () => void;
  onBack: () => void;
}

export function ProfileStep1({ form, setForm, errors, setErrors, firstNameRef, category, onNext, onBack }: Props) {
  const { t } = useI18n();
  const clearError = (k: string) => setErrors((prev) => ({ ...prev, [k]: undefined }));
  const roles = category === "enterprise" ? ENTERPRISE_ROLES : ROLES;

  const handleNext = () => {
    if (!form.firstName.trim()) {
      setErrors((p) => ({ ...p, firstName: "First name is required" }));
      return;
    }
    if (!form.lastName.trim()) {
      setErrors((p) => ({ ...p, lastName: "Last name is required" }));
      return;
    }
    if (!form.role) {
      setErrors((p) => ({ ...p, role: "Please select a role" }));
      return;
    }
    if (!form.mobile || form.mobile.trim().length < 7) {
      setErrors((p) => ({ ...p, mobile: "Mobile number is required" }));
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName" className="mb-1.5 text-xs">{t("auth.firstName")}</Label>
          <Input
            id="firstName"
            ref={firstNameRef}
            value={form.firstName}
            onChange={(e) => { setForm((f) => ({ ...f, firstName: e.target.value })); clearError("firstName"); }}
            placeholder="Ali"
            className={`h-12 text-base ${errors.firstName ? "border-destructive" : ""}`}
            autoComplete="given-name"
          />
          <FieldError msg={errors.firstName} />
        </div>
        <div>
          <Label htmlFor="lastName" className="mb-1.5 text-xs">{t("auth.lastName")}</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) => { setForm((f) => ({ ...f, lastName: e.target.value })); clearError("lastName"); }}
            placeholder="Khan"
            className={`h-12 text-base ${errors.lastName ? "border-destructive" : ""}`}
            autoComplete="family-name"
          />
          <FieldError msg={errors.lastName} />
        </div>
      </div>

      <div>
        <Label className="mb-2 text-xs block">{category === "enterprise" ? "My role in the organisation" : t("signup.iAm")}</Label>
        <div className="flex gap-2 flex-wrap">
          {roles.map((r) => (
            <RoleButton
              key={r}
              active={form.role === r}
              onClick={() => { setForm((f) => ({ ...f, role: r })); clearError("role"); }}
            >
              {r}
            </RoleButton>
          ))}
        </div>
        <FieldError msg={errors.role} />
      </div>

      <div>
        <Label htmlFor="mobile" className="mb-1.5 text-xs">{t("auth.mobile")}</Label>
        <Input
          id="mobile"
          value={form.mobile ?? ""}
          onChange={(e) => { setForm((f) => ({ ...f, mobile: e.target.value })); clearError("mobile"); }}
          type="tel"
          inputMode="tel"
          placeholder="+92 300 0000000"
          className={`h-12 text-base ${errors.mobile ? "border-destructive" : ""}`}
          autoComplete="tel"
        />
        <FieldError msg={errors.mobile} />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 px-4" onClick={onBack}>
          <ChevronLeft size={16} />
        </Button>
        <Button
          type="button"
          className="flex-1 h-12 bg-gradient-primary font-semibold shadow-glow text-base"
          onClick={handleNext}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
