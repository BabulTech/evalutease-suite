import { Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvitePreview } from "./useAcceptInvite";

export function AuthForm({
  invitePreview,
  mode,
  setMode,
  form,
  setForm,
  showPass,
  setShowPass,
  loading,
  onSignup,
  onLogin,
}: {
  invitePreview: InvitePreview;
  mode: "signup" | "login";
  setMode: (m: "signup" | "login") => void;
  form: { full_name: string; email: string; password: string };
  setForm: (fn: (prev: typeof form) => typeof form) => void;
  showPass: boolean;
  setShowPass: (v: boolean) => void;
  loading: boolean;
  onSignup: () => void;
  onLogin: () => void;
}) {
  const submit = mode === "signup" ? onSignup : onLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="size-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              Join {invitePreview?.company_name ?? "Organization"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              You've been invited to join as a Host on Jancho
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
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="your@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Min. 6 characters"
                className="pr-10"
                onKeyDown={(e) => e.key === "Enter" && void submit()}
              />
              <button
                type="button"
                title={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            onClick={() => void submit()}
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create Account & Join"
                : "Login & Join"}
          </Button>
        </div>
      </div>
    </div>
  );
}
