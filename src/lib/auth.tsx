import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logClientActivity } from "@/lib/audit";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

// Guard so we only attempt the profile self-heal once per page load,
// regardless of how many auth events fire (token refresh, tab focus, etc.).
const ensuredProfileFor = new Set<string>();

async function ensureProfile(user: import("@supabase/supabase-js").User) {
  if (ensuredProfileFor.has(user.id)) return;
  ensuredProfileFor.add(user.id);

  // Only INSERT when the row is genuinely missing. Never UPDATE an existing
  // profile here — a blind upsert fires an UPDATE on every load and spams the
  // activity feed with "Updated profiles" noise.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return; // row already there — nothing to do, no audit noise

  const meta = user.user_metadata ?? {};
  const fullName =
    [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
    meta.full_name ||
    user.email?.split("@")[0] ||
    "User";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("profiles").insert({
    id: user.id,
    email: user.email,
    full_name: fullName,
    selected_plan: meta.selected_plan ?? "individual_starter",
  });
  // Note: user_credits / user_roles / user_subscriptions are created by the
  // handle_new_user DB trigger on signup.
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: set up listener FIRST then check existing session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) void ensureProfile(sess.user);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      // Self-heal: ensure profile row exists for this user
      if (sess?.user) void ensureProfile(sess.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (user) {
      await logClientActivity({
        actionType: "signed_out",
        module: "auth",
        entityType: "session",
        entityLabel: user.email ?? null,
        message: "Signed out",
        details: { user_email: user.email },
        riskScore: 0,
      });
    }
    await supabase.auth.signOut();
  }, [user]);

  const ctxValue = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut],
  );

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- standard context+hook co-location
export function useAuth() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
