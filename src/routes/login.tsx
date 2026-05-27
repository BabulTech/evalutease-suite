import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { logClientActivity } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "./login/AuthShell";
import { GoogleIcon } from "./login/GoogleIcon";

// react-doctor-disable-next-line react-doctor/only-export-components
export { AuthShell } from "./login/AuthShell";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/login")({ component: LoginPage });

const schema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/only-export-components
function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const validate = () => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: typeof errors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") errs.email = issue.message;
        if (issue.path[0] === "password") errs.password = issue.message;
      }
      setErrors(errs);
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logClientActivity({
      actionType: "signed_in",
      module: "auth",
      entityType: "session",
      entityLabel: data.email,
      message: "Signed in with email",
      details: { method: "password" },
      riskScore: 5,
    });
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
  };

  return (
    <AuthShell>
      <div className="text-center mb-7">
        <div className="flex justify-center mb-5">
          <img src="/jancho_logo_512.svg" alt="Jancho" className="h-28 w-28 object-contain" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-6 p-1.5 bg-secondary/50 rounded-2xl">
        <button
          type="button"
          className="rounded-xl py-3 text-sm font-semibold bg-primary text-primary-foreground shadow-glow"
          aria-current="page"
        >
          {t("auth.signin")}
        </button>
        <Link
          to="/signup"
          className="rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground text-center block transition-colors"
        >
          {t("auth.signup")}
        </Link>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 mb-4 gap-3 bg-secondary/40 hover:bg-secondary border-border text-sm font-semibold"
        onClick={onGoogle}
        disabled={loading}
      >
        {loading ? (
          <span className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {loading ? "Redirecting…" : t("auth.continueGoogle")}
      </Button>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground tracking-widest">{t("auth.or")}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email" className="mb-2 text-sm font-medium">
            {t("auth.email")}
          </Label>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="you@example.com"
            className={`h-12 text-base ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="password" className="text-sm font-medium">
              {t("auth.password")}
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:underline font-medium"
            >
              {t("auth.forgot")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder="••••••••"
              className={`h-12 text-base pr-12 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPass((p) => !p)}
              className="absolute right-0 top-0 size-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="mt-1.5 text-xs text-destructive">
              {errors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90 text-base mt-2 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2.5">
              <span className="relative size-4 shrink-0">
                <span className="absolute inset-0 rounded-full border-2 border-primary-foreground/20" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-foreground animate-spin" />
              </span>
              Signing you in…
            </span>
          ) : (
            t("auth.login")
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="text-primary font-semibold hover:underline">
          {t("auth.signup")}
        </Link>
      </p>
    </AuthShell>
  );
}
