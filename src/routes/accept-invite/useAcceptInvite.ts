import { useEffect, useState } from "react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { supabase } from "@/integrations/supabase/client";
import { logClientActivity } from "@/lib/audit";

export type InvitePreview = {
  company_name: string;
  invited_email: string;
  member_email_lc: string;
} | null;

export function useAcceptInvite(
  token: string | undefined,
  member_id: string | undefined,
  invitedEmail: string | undefined,
) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [invitePreview, setInvitePreview] = useState<InvitePreview>(null);
  const [form, setForm] = useState({ full_name: "", email: invitedEmail ?? "", password: "" });

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) setCurrentUser({ id: session.user.id, email: session.user.email ?? "" });
      // react-doctor-disable-next-line react-doctor/no-event-handler
      if (token && member_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("preview_company_invite", {
          p_member_id: member_id,
          p_token: token,
        });
        if (data && data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const linkMember = async (userId: string): Promise<boolean> => {
    if (!member_id || !token) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      validationError("This invite is invalid, expired, or has already been claimed.");
      return false;
    }
    return true;
  };

  const goToDashboardFresh = () => {
    window.location.href = "/dashboard";
  };

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
      void logClientActivity({
        actionType: "invite_accepted",
        module: "auth",
        entityType: "company_member",
        entityLabel: invitePreview?.company_name ?? null,
        message: `Accepted host invite to ${invitePreview?.company_name ?? "organization"}`,
        riskScore: 15,
      });
      toast.success(`Joined ${invitePreview?.company_name ?? "organization"}!`);
      goToDashboardFresh();
    }
  };

  const handleSignOutAndRetry = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setMode("login");
  };

  const handleSignup = async () => {
    if (!form.full_name.trim()) {
      validationError("Full name required");
      return;
    }
    if (!form.email.trim()) {
      validationError("Email required");
      return;
    }
    if (form.password.length < 6) {
      validationError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim() } },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!data.user) {
      toast.error("Signup did not return a user");
      setLoading(false);
      return;
    }
    const ok = await linkMember(data.user.id);
    setLoading(false);
    if (!ok) return;
    if (data.session) {
      toast.success(`Joined ${invitePreview?.company_name ?? "organization"}!`);
      goToDashboardFresh();
    } else {
      toast.success("Account created. Check your email to confirm.");
    }
  };

  const handleLogin = async () => {
    if (!form.email.trim() || !form.password) {
      validationError("Email and password required");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!data.user) {
      toast.error("Login did not return a user");
      setLoading(false);
      return;
    }
    const ok = await linkMember(data.user.id);
    setLoading(false);
    if (!ok) return;
    toast.success(`Joined ${invitePreview?.company_name ?? "organization"}!`);
    goToDashboardFresh();
  };

  return {
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
  };
}
