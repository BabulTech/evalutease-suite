import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type HostInfo = {
  member_id: string;
  full_name: string;
  role: string;
  /** Lifetime credits allocated to this host (audit / history). */
  credit_limit: number;
  /** Legacy counter; not used as a source of truth. */
  credits_used: number;
  /** REAL current balance from user_credits.balance. Use this for "Available". */
  balance: number;
  total_earned: number;
  total_spent: number;
  company_id: string;
  company_name: string;
  admin_user_id: string;
  admin_name: string | null;
  admin_email: string | null;
  org_plan_name: string | null;
  org_plan_slug: string | null;
};

type HostContextValue = {
  isHost: boolean;
  hostInfo: HostInfo | null;
  loading: boolean;
  reload: () => void;
};

const HostContext = createContext<HostContextValue>({
  isHost: false,
  hostInfo: null,
  loading: true,
  reload: () => {},
});

export function HostProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_my_host_context");
    // eslint-disable-next-line no-console
    console.log("[HostContext] RPC result", { userId: user.id, data, error });
    if (error || !data || data.length === 0) {
      setHostInfo(null);
    } else {
      const r = data[0] as any;
      setHostInfo({
        member_id: r.member_id,
        full_name: r.member_full_name,
        role: r.member_role ?? "host",
        credit_limit: r.member_credit_limit ?? 0,
        credits_used: r.member_credits_used ?? 0,
        balance: r.host_balance ?? 0,
        total_earned: r.host_total_earned ?? 0,
        total_spent: r.host_total_spent ?? 0,
        company_id: r.org_company_id,
        company_name: r.company_name ?? "Your Organization",
        admin_user_id: r.admin_user_id,
        admin_name: r.admin_name ?? null,
        admin_email: r.admin_email ?? null,
        org_plan_name: r.org_plan_name ?? null,
        org_plan_slug: r.org_plan_slug ?? null,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return (
    <HostContext.Provider value={{ isHost: !!hostInfo, hostInfo, loading, reload: load }}>
      {children}
    </HostContext.Provider>
  );
}

export const useHost = () => useContext(HostContext);
