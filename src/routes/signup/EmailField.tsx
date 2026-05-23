import { useRef, useState, useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { FieldError } from "./-components";

type EmailCheckState = "idle" | "checking" | "taken" | "available";

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
  onCheckStateChange: (state: EmailCheckState) => void;
  error?: string;
}

export function EmailField({ value, onChange, onCheckStateChange, error }: EmailFieldProps) {
  const [checkState, setCheckState] = useState<EmailCheckState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(
    (email: string) => {
      if (timer.current) clearTimeout(timer.current);
      const trimmed = email.trim();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setCheckState("idle");
        onCheckStateChange("idle");
        return;
      }
      setCheckState("checking");
      onCheckStateChange("checking");
      timer.current = setTimeout(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- check_email_exists RPC not yet in generated types
        const { data } = await (supabase as any).rpc("check_email_exists", { p_email: trimmed });
        const state: EmailCheckState = data ? "taken" : "available";
        setCheckState(state);
        onCheckStateChange(state);
      }, 600);
    },
    [onCheckStateChange],
  );

  return (
    <div>
      <Label htmlFor="email" className="mb-1.5 text-xs">
        Email
      </Label>
      <div className="relative">
        <Input
          id="email"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            check(e.target.value);
          }}
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          className={`h-12 text-base pr-10 ${error || checkState === "taken" ? "border-destructive" : checkState === "available" ? "border-green-500" : ""}`}
          autoComplete="email"
          aria-invalid={!!error || checkState === "taken"}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {checkState === "checking" && (
            <Loader2 size={15} className="animate-spin text-muted-foreground" />
          )}
          {checkState === "available" && <Check size={15} className="text-green-500" />}
          {checkState === "taken" && <span className="text-destructive text-lg font-bold">✕</span>}
        </div>
      </div>
      {checkState === "taken" && (
        <p className="mt-1 text-xs text-destructive flex items-center gap-1">
          An account with this email already exists.{" "}
          <Link to="/login" className="underline font-semibold">
            Sign in instead?
          </Link>
        </p>
      )}
      {checkState === "available" && (
        <p className="mt-1 text-xs text-green-500">Email is available ✓</p>
      )}
      <FieldError msg={error} />
    </div>
  );
}
