import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Eye, EyeOff, CheckCircle2, LogOut, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: z.object({
    token: z.string().optional(),
    member_id: z.string().optional(),
    email: z.string().optional(),
  }),
  component: AcceptInvitePage,
});

type InvitePreview = { company_name: string; invited_email: string; member_email_lc: string } | null;

function AcceptInvitePage() {
  const { token, member_id, email: invitedEmail } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [invitePreview, setInvitePreview] = useState<InvitePreview>(null);
  const [form, setForm] = useState({ full_name: "", email: invitedEmail ?? "", password: "" });

  // On mount: check who's signed in (if anyone) and load the invite preview.
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser({ id: session.user.id, email: session.user.email ?? "" });
      }
      if (token && member_id) {
        // Fetch preview server-side via RPC so we bypass RLS on company_members
        const { data } = await (supabase as any).rpc("preview_company_invite", {
          p_member_id: member_id,
          p_token: token,
        });
        if (data && data.length > 0) {
          const r = data[0] as any;
          setInvitePreview({
            company_name: r.company_name ?? "Organization",
            invited_email: r.invited_email ?? "",
            member_email_lc: (r.invited_email ?? "").toLowerCase(),
          });
        }
      }
      setBootstrapping(false);
    })();
  }, [token, member_id]);

  // Atomic linker — verifies token, links auth user, transfers initial credits.
  const linkMember = async (userId: string): Promise<boolean> => {
    if (!member_id || !token) return false;
    const { data, error } = await (supabase as any).rpc("accept_company_invite", {
      p_member_id: member_id,
      p_token: token,
      p_host_user_id: userId,
    });
    if (error) {
      const msg = error.message?.includes("unauthorized")
        ? "This invite does not belong to your account."
        : error.message;
      toast.error(`Link failed: ${msg}`);
      return false;
    }
    if (data === false) {
      toast.error("This invite is invalid, expired, or has already been claimed.");
      return false;
    }
    return true;
  };

  // After a successful link we hard-reload so EVERY provider (Host, Plan, Profile)
  // re-fetches fresh data. SPA navigation alone leaves stale context behind.
  const goToDashboardFresh = () => {
    window.location.href = "/dashboard";
  };

  // Path A: already-logged-in user clicks "Join organization".
  const handleJoinAsCurrentUser = async () => {
    if (!currentUser) return;
    if (invitePreview && currentUser.email.toLowerCase() !== invitePreview.member_email_lc) {
      toast.error(
        `This invite is for ${invitePreview.invited_email}. You're signed in as ${currentUser.email}. Sign out first.`,
      );
      return;
    }
    setLoading(true);
    const ok = await linkMember(currentUser.id);
    setLoading(false);
    if (ok) {
      toast.success(`Joined ${invitePreview?.company_name ?? "organization"}!`);
      goToDashboardFresh();
    }
  };

  const handleSignOutAndRetry = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setMode("login");
  };

  // Path B: new account
  const handleSignup = async () => {
    if (!form.full_name.trim()) { toast.error("Full name required"); return; }
    if (!form.email.trim()) { toast.error("Email required"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim() } },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (!data.user) { toast.error("Signup did not return a user"); setLoading(false); return; }
    const ok = await linkMember(data.user.id);
    setLoading(false);
    if (!ok) return;
    if (data.session) {
      // Email confirmation disabled — user is signed in immediately
      toast.success(`Joined ${invitePreview?.company_name ?? "organization"}!`);
      goToDashboardFresh();
    } else {
      // Email confirmation enabled — show success screen, ask user to confirm
      toast.success("Account created. Check your email to confirm.");
    }
  };

  // Path C: existing account, not currently signed in
  const handleLogin = async () => {
    if (!form.email.trim() || !form.password) { toast.error("Email and password required"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (!data.user) { toast.error("Login did not return a user"); setLoading(false); return; }
    const ok = await linkMember(data.user.id);
    setLoading(false);
    if (!ok) return;
    toast.success(`Joined ${invitePreview?.company_name ?? "organization"}!`);
    goToDashboardFresh();
  };

  // ── Invalid / missing params ─────────────────────────────────────
  if (!token || !member_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Invalid or expired invite link.</p>
          <p className="text-sm text-muted-foreground">Please contact your organization admin.</p>
        </div>
      </div>
    );
  }

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  // ── Branch: user is already signed in → one-click join ───────────
  if (currentUser) {
    const emailMatch =
      !invitePreview || currentUser.email.toLowerCase() === invitePreview.member_email_lc;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Join {invitePreview?.company_name ?? "Organization"}</h1>
            <p className="text-sm text-muted-foreground">
              You're signed in as <span className="font-semibold text-foreground">{currentUser.email}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            {emailMatch ? (
              <>
                <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-success">Ready to join</div>
                    <div className="text-muted-foreground mt-0.5">
                      This invite matches your account. Click below to link it.
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-2"
                  onClick={() => void handleJoinAsCurrentUser()}
                  disabled={loading}
                >
                  {loading ? "Joining…" : `Join as ${currentUser.email}`}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-warning/10 border border-warning/20 px-4 py-3 text-xs">
                  <div className="font-semibold text-warning mb-1">Different account detected</div>
                  <div className="text-muted-foreground">
                    This invite is for <strong className="text-foreground">{invitePreview?.invited_email}</strong>{" "}
                    but you're signed in as <strong className="text-foreground">{currentUser.email}</strong>.
                  </div>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={() => void handleSignOutAndRetry()}>
                  <LogOut className="h-4 w-4" /> Sign out & use invited email
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Branch: not signed in → signup / login ──────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Join {invitePreview?.company_name ?? "Organization"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              You've been invited to join as a Host on EvaluTease
            </p>
          </div>
        </div>

        <div className="flex rounded-xl border border-border bg-muted/30 p-1">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === m ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signup" ? "Create Account" : "Already have account"}
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 6 characters"
                className="pr-10"
                onKeyDown={(e) => e.key === "Enter" && void (mode === "signup" ? handleSignup() : handleLogin())}
              />
              <button
                type="button"
                title={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            onClick={() => void (mode === "signup" ? handleSignup() : handleLogin())}
            disabled={loading}
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create Account & Join" : "Login & Join"}
          </Button>
        </div>
      </div>
    </div>
  );
}
