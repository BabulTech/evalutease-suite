import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleDetails } from "./RoleDetails";
import { EmailField } from "./EmailField";
import { PasswordField } from "./PasswordField";
import { isFreeEmailDomain, requiresWorkEmail } from "./constants";
import type { SignupFormData, FieldErrors } from "./-schema";

type FormState = SignupFormData & { useCases: string[] };
type SetForm = React.Dispatch<React.SetStateAction<FormState>>;

interface Props {
  form: FormState;
  setForm: SetForm;
  errors: FieldErrors;
  setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  category: string;
  onNext: () => void;
  onBack: () => void;
  onEmailCheckChange: (state: "idle" | "checking" | "taken" | "available") => void;
  emailCheckStateRef: React.MutableRefObject<"idle" | "checking" | "taken" | "available">;
}

export function ProfileStep2({
  form,
  setForm,
  errors,
  setErrors,
  category,
  onNext,
  onBack,
  onEmailCheckChange,
  emailCheckStateRef,
}: Props) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const clearError = (k: string) => setErrors((prev) => ({ ...prev, [k]: undefined }));

  const handleNext = () => {
    if (emailCheckStateRef.current === "taken") {
      setErrors((p) => ({ ...p, email: "This email is already registered" }));
      return;
    }
    if (!form.email.trim()) {
      setErrors((p) => ({ ...p, email: "Email is required" }));
      return;
    }
    if (requiresWorkEmail(category, form.enterpriseType) && isFreeEmailDomain(form.email)) {
      setErrors((p) => ({
        ...p,
        email: "Please use your work email — personal providers like Gmail or Yahoo aren't allowed for company accounts.",
      }));
      return;
    }
    if (!form.password || form.password.length < 8) {
      setErrors((p) => ({ ...p, password: "Password must be at least 8 characters" }));
      return;
    }
    if (confirmPassword !== form.password) {
      setErrors((p) => ({ ...p, confirmPassword: "Passwords do not match" }));
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-5">
      <RoleDetails role={form.role} form={form} setForm={setForm} category={category} />

      <EmailField
        value={form.email}
        onChange={(v) => { setForm((f) => ({ ...f, email: v })); clearError("email"); }}
        onCheckStateChange={onEmailCheckChange}
        error={errors.email}
      />

      <PasswordField
        value={form.password}
        onChange={(v) => { setForm((f) => ({ ...f, password: v })); clearError("password"); }}
        error={errors.password}
        confirmValue={confirmPassword}
        onConfirmChange={(v) => { setConfirmPassword(v); clearError("confirmPassword"); }}
        confirmError={errors.confirmPassword}
      />

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
