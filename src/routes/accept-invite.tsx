import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useAcceptInvite } from "./accept-invite/useAcceptInvite";
import { LoggedInView } from "./accept-invite/LoggedInView";
import { AuthForm } from "./accept-invite/AuthForm";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/accept-invite")({
  validateSearch: z.object({
    token: z.string().optional(),
    member_id: z.string().optional(),
    email: z.string().optional(),
  }),
  component: AcceptInvitePage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function AcceptInvitePage() {
  const { token, member_id, email: invitedEmail } = Route.useSearch();
  const {
    mode,
    setMode,
    loading,
    bootstrapping,
    showPass,
    setShowPass,
    currentUser,
    invitePreview,
    form,
    setForm,
    handleJoinAsCurrentUser,
    handleSignOutAndRetry,
    handleSignup,
    handleLogin,
  } = useAcceptInvite(token, member_id, invitedEmail);

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
        <div className="size-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (currentUser) {
    return (
      <LoggedInView
        currentUser={currentUser}
        invitePreview={invitePreview}
        loading={loading}
        onJoin={() => void handleJoinAsCurrentUser()}
        onSignOut={() => void handleSignOutAndRetry()}
      />
    );
  }

  return (
    <AuthForm
      invitePreview={invitePreview}
      mode={mode}
      setMode={setMode}
      form={form}
      setForm={setForm}
      showPass={showPass}
      setShowPass={setShowPass}
      loading={loading}
      onSignup={() => void handleSignup()}
      onLogin={() => void handleLogin()}
    />
  );
}
