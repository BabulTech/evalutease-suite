import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { AuthShell } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) { toast.error("Invalid email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success(t("auth.resetSent"));
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold mb-2">{t("auth.reset")}</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {sent ? t("auth.resetSent") : "Enter your email to receive a reset link."}
      </p>
      {!sent && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">{t("auth.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
            {loading ? t("common.loading") : t("auth.reset")}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link to="/login" className="text-primary font-semibold hover:underline">← {t("auth.signin")}</Link>
      </p>
    </AuthShell>
  );
}
