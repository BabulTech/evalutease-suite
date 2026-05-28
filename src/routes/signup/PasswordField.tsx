import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPasswordStrength, PW_RULES } from "./constants";
import { FieldError } from "./-components";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  confirmValue?: string;
  onConfirmChange?: (value: string) => void;
  confirmError?: string;
}

export function PasswordField({
  value,
  onChange,
  error,
  confirmValue,
  onConfirmChange,
  confirmError,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState(false);
  const pwStrength = getPasswordStrength(value);
  const confirmMatch = confirmValue !== undefined && confirmValue.length > 0 && confirmValue === value;
  const confirmMismatch = confirmValue !== undefined && confirmValue.length > 0 && confirmValue !== value;

  return (
    <div className="space-y-4">
      {/* Password */}
      <div>
        <Label htmlFor="password" className="mb-1.5 text-xs">Password</Label>
        <div className="relative">
          <Input
            id="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            type={show ? "text" : "password"}
            placeholder="Min. 8 characters"
            className={`h-12 text-base pr-12 ${error ? "border-destructive" : ""}`}
            autoComplete="new-password"
            aria-invalid={!!error}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-0 top-0 size-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Strength bar */}
        {value.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.color : "bg-border"}`}
                />
              ))}
            </div>
            <p className={`text-xs font-semibold ${pwStrength.score <= 2 ? "text-red-400" : pwStrength.score === 3 ? "text-yellow-400" : pwStrength.score === 4 ? "text-blue-400" : "text-green-400"}`}>
              {pwStrength.label}
            </p>
          </div>
        )}

        {/* Rules - always shown when field has value or focused */}
        {(focused || value.length > 0) && (
          <ul className="mt-2 grid grid-cols-1 gap-1 p-3 rounded-xl bg-secondary/40 border border-border">
            {PW_RULES.map((rule) => {
              const passed = rule.test(value);
              return (
                <li
                  key={rule.label}
                  className={`flex items-center gap-2 text-xs transition-colors ${passed ? "text-green-400" : "text-muted-foreground"}`}
                >
                  {passed
                    ? <Check size={11} className="shrink-0" />
                    : <X size={11} className="shrink-0 text-muted-foreground/50" />
                  }
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}

        <FieldError msg={error} />
      </div>

      {/* Confirm password */}
      {onConfirmChange !== undefined && (
        <div>
          <Label htmlFor="confirmPassword" className="mb-1.5 text-xs">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              value={confirmValue ?? ""}
              onChange={(e) => onConfirmChange(e.target.value)}
              type={showConfirm ? "text" : "password"}
              placeholder="Re-enter your password"
              className={`h-12 text-base pr-12 ${confirmMismatch ? "border-destructive" : confirmMatch ? "border-success" : ""}`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-0 top-0 size-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {confirmMatch && (
              <div className="absolute right-12 top-0 size-12 flex items-center justify-center text-success pointer-events-none">
                <Check size={16} />
              </div>
            )}
          </div>
          {confirmMismatch && (
            <p className="mt-1.5 text-xs text-destructive">Passwords do not match</p>
          )}
          {confirmMatch && (
            <p className="mt-1.5 text-xs text-success">Passwords match ✓</p>
          )}
          <FieldError msg={confirmError} />
        </div>
      )}
    </div>
  );
}
