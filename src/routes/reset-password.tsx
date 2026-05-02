import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { AuthShell } from "./login";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase handles the recovery hash and creates a session automatically.
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Min 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold mb-6">{t("auth.reset")}</h1>
      {!ready ? (
        <p className="text-muted-foreground text-sm">Open this page from the email link to reset your password.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
            {loading ? t("common.loading") : t("auth.reset")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
