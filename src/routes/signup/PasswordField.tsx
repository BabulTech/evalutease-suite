import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPasswordStrength, PW_RULES } from "./constants";
import { FieldError } from "./-components";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function PasswordField({ value, onChange, error }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const pwStrength = getPasswordStrength(value);

  return (
    <div>
      <Label htmlFor="password" className="mb-1.5 text-xs">
        Password
      </Label>
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
      {value.length > 0 && (
        <div className="mt-2">
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.color : "bg-border"}`}
              />
            ))}
          </div>
          <p
            className={`text-xs font-medium ${pwStrength.score <= 2 ? "text-red-400" : pwStrength.score === 3 ? "text-yellow-400" : pwStrength.score === 4 ? "text-blue-400" : "text-green-400"}`}
          >
            {pwStrength.label}
          </p>
        </div>
      )}
      {(focused || error) && value.length > 0 && (
        <ul className="mt-2 space-y-1">
          {PW_RULES.map((rule) => {
            const passed = rule.test(value);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 text-xs transition-colors ${passed ? "text-green-400" : "text-muted-foreground"}`}
              >
                <Check size={10} className={passed ? "opacity-100" : "opacity-0"} />
                <span className={passed ? "" : "pl-3.5"}>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      <FieldError msg={error} />
    </div>
  );
}
