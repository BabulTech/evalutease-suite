import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
    // browser redirects automatically on success
  };

  return (
    <AuthShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-bold">{t("auth.title")}</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm">{t("auth.subtitle")}</p>
        </div>
        <Logo size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-secondary/50 rounded-xl">
        <button className="rounded-lg py-2.5 text-sm font-semibold bg-primary text-primary-foreground shadow-glow">
          {t("auth.signin")}
        </button>
        <Link
          to="/signup"
          className="rounded-lg py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground text-center"
        >
          {t("auth.signup")}
        </Link>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 mb-3 gap-3 bg-secondary/40 hover:bg-secondary border-border"
        onClick={onGoogle}
        disabled={loading}
      >
        <GoogleIcon />
        <span className="font-semibold">{t("auth.continueGoogle")}</span>
      </Button>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground tracking-widest">{t("auth.or")}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="mb-1.5">{t("auth.email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t("auth.forgot")}
            </Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90">
          {loading ? t("common.loading") : t("auth.login")}
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

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <LanguageSwitcher />
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card/70 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-elegant">
          {children}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
