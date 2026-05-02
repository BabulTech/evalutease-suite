import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { AuthShell } from "./login";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const schema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(60),
  lastName: z.string().trim().min(1, "Last name required").max(60),
  organization: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "", lastName: "", organization: "", mobile: "", email: "", password: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
          organization: parsed.data.organization,
          mobile: parsed.data.mobile,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Welcome.");
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) { setLoading(false); toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-bold">{t("auth.signup")}</h1>
          <p className="text-muted-foreground text-sm mt-2">{t("auth.subtitle")}</p>
        </div>
        <Logo size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-secondary/50 rounded-xl">
        <Link to="/login" className="rounded-lg py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground text-center">
          {t("auth.signin")}
        </Link>
        <button className="rounded-lg py-2.5 text-sm font-semibold bg-primary text-primary-foreground shadow-glow">
          {t("auth.signup")}
        </button>
      </div>

      <Button type="button" variant="outline" className="w-full h-12 mb-5 gap-3 bg-secondary/40 hover:bg-secondary" onClick={onGoogle} disabled={loading}>
        <span className="font-semibold">{t("auth.continueGoogle")}</span>
      </Button>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5">{t("auth.firstName")}</Label>
            <Input value={form.firstName} onChange={set("firstName")} />
          </div>
          <div>
            <Label className="mb-1.5">{t("auth.lastName")}</Label>
            <Input value={form.lastName} onChange={set("lastName")} />
          </div>
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.organization")}</Label>
          <Input value={form.organization} onChange={set("organization")} />
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.mobile")}</Label>
          <Input value={form.mobile} onChange={set("mobile")} type="tel" />
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.email")}</Label>
          <Input value={form.email} onChange={set("email")} type="email" />
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.password")}</Label>
          <Input value={form.password} onChange={set("password")} type="password" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90">
          {loading ? t("common.loading") : t("auth.signup")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="text-primary font-semibold hover:underline">{t("auth.signin")}</Link>
      </p>
    </AuthShell>
  );
}
