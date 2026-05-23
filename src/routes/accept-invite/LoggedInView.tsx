import { ArrowRight, Building2, CheckCircle2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvitePreview } from "./useAcceptInvite";

export function LoggedInView({
  currentUser,
  invitePreview,
  loading,
  onJoin,
  onSignOut,
}: {
  currentUser: { id: string; email: string };
  invitePreview: InvitePreview;
  loading: boolean;
  onJoin: () => void;
  onSignOut: () => void;
}) {
  const emailMatch =
    !invitePreview || currentUser.email.toLowerCase() === invitePreview.member_email_lc;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">
            Join {invitePreview?.company_name ?? "Organization"}
          </h1>
          <p className="text-sm text-muted-foreground">
            You're signed in as{" "}
            <span className="font-semibold text-foreground">{currentUser.email}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          {emailMatch ? (
            <>
              <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3 flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-success mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-success">Ready to join</div>
                  <div className="text-muted-foreground mt-0.5">
                    This invite matches your account. Click below to link it.
                  </div>
                </div>
              </div>
              <Button
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-2"
                onClick={onJoin}
                disabled={loading}
              >
                {loading ? "Joining…" : `Join as ${currentUser.email}`}
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-warning/10 border border-warning/20 px-4 py-3 text-xs">
                <div className="font-semibold text-warning mb-1">Different account detected</div>
                <div className="text-muted-foreground">
                  This invite is for{" "}
                  <strong className="text-foreground">{invitePreview?.invited_email}</strong> but
                  you're signed in as{" "}
                  <strong className="text-foreground">{currentUser.email}</strong>.
                </div>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={onSignOut}>
                <LogOut className="size-4" /> Sign out & use invited email
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
